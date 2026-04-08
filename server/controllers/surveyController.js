// server/controllers/surveyController.js

import supabase from "../config/supabase.js";

// ── GET /api/v1/survey/period ─────────────────────────────────────────────────
export async function getActivePeriod(req, res) {
  const { data, error } = await supabase
    .from("evaluation_periods")
    .select("id, label, start_date, end_date")
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ message: "No active evaluation period found." });
    }
    console.error("❌ getActivePeriod error:", error.message);
    return res.status(500).json({ message: "Database error." });
  }

  return res.status(200).json(data);
}

// ── GET /api/v1/survey/ratees?relationship=subordinate|superior|peer ──────────
export async function getRatees(req, res) {
  const raterId          = req.user.sub;
  const { relationship } = req.query;

  if (!relationship) {
    return res.status(400).json({ message: "relationship query param is required." });
  }

  // 1. Get active period
  const { data: period, error: periodError } = await supabase
    .from("evaluation_periods")
    .select("id")
    .eq("is_active", true)
    .single();

  if (periodError || !period) {
    return res.status(404).json({ message: "No active evaluation period found." });
  }

  // 2. Get ONLY ratees assigned to this rater with the specified relationship
  const { data: assignments, error: assignError } = await supabase
    .from("ratee_rater_assignments")
    .select("ratee_id")
    .eq("rater_id", raterId)
    .eq("period_id", period.id)
    .eq("relationship", relationship);

  if (assignError) {
    console.error("❌ getRatees assignments error:", assignError.message);
    return res.status(500).json({ message: "Database error fetching assignments." });
  }

  if (!assignments || assignments.length === 0) {
    return res.status(200).json({ period_id: period.id, ratees: [] });
  }

  const assignedRateeIds = assignments.map((a) => a.ratee_id);

  // 3. Fetch user details for only those assigned ratees
  const { data: assignedUsers, error: usersError } = await supabase
    .from("users")
    .select("id, full_name, department_id")
    .eq("is_active", true)
    .in("id", assignedRateeIds)
    .order("full_name", { ascending: true });

  if (usersError) {
    console.error("❌ getRatees users error:", usersError.message);
    return res.status(500).json({ message: "Database error fetching users." });
  }

  // 4. Check which ratees the rater already submitted for
  const { data: submitted, error: subError } = await supabase
    .from("submissions")
    .select("ratee_id")
    .eq("rater_id", raterId)
    .eq("period_id", period.id)
    .eq("relationship", relationship)
    .eq("is_complete", true);

  if (subError) {
    console.error("❌ getRatees submissions error:", subError.message);
    return res.status(500).json({ message: "Database error fetching submissions." });
  }

  const submittedRateeIds = new Set((submitted ?? []).map((s) => s.ratee_id));

  const ratees = (assignedUsers ?? []).map((u) => ({
    ratee_id:      u.id,
    full_name:     u.full_name,
    department_id: u.department_id,
    is_submitted:  submittedRateeIds.has(u.id),
  }));

  return res.status(200).json({ period_id: period.id, ratees });
}

// ── GET /api/v1/survey/status?ratee_id=&relationship= ────────────────────────
// Returns { is_submitted: boolean }
// Used by category page 1 to immediately redirect already-submitted raters.
export async function getSurveyStatus(req, res) {
  const raterId                    = req.user.sub;
  const { ratee_id, relationship } = req.query;

  if (!ratee_id || !relationship) {
    return res.status(400).json({ message: "ratee_id and relationship are required." });
  }

  // Get active period
  const { data: period, error: periodError } = await supabase
    .from("evaluation_periods")
    .select("id")
    .eq("is_active", true)
    .single();

  if (periodError || !period) {
    return res.status(404).json({ message: "No active evaluation period found." });
  }

  // Check for existing complete submission
  const { data: existing, error } = await supabase
    .from("submissions")
    .select("id")
    .eq("rater_id",     raterId)
    .eq("ratee_id",     ratee_id)
    .eq("period_id",    period.id)
    .eq("relationship", relationship)
    .eq("is_complete",  true)
    .maybeSingle();

  if (error) {
    console.error("❌ getSurveyStatus error:", error.message);
    return res.status(500).json({ message: "Database error." });
  }

  return res.status(200).json({ is_submitted: !!existing });
}

// ── POST /api/v1/survey/submit ────────────────────────────────────────────────
// Body: { ratee_id, relationship, period_id?, date_evaluated, answers[], comments{} }
//
// answers[] shape: [{ question_id: "peer1.1"|"subor2.3", score: number|null, is_na: boolean }]
//
// The frontend sends positional string IDs like "peer1.1", "subor2.3".
// This controller maps them to real UUIDs from the questions table by matching
// category sort_order + question sort_order for the given relationship.
//
// Flow:
//   1. Validate body
//   2. Resolve active period
//   3. Duplicate check → 409
//   4. Fetch all questions for this relationship → build position→UUID map
//   5. INSERT submission (is_complete = false)
//   6. Bulk INSERT answers
//   7. UPDATE submission is_complete = true
//   8. Return 201
export async function submitSurvey(req, res) {
  const raterId = req.user.sub;
  const {
    ratee_id,
    relationship,
    period_id: bodyPeriodId,
    date_evaluated,
    answers,
    comments,
  } = req.body;

  // ── 1. Validate ─────────────────────────────────────────────────────────────
  if (!ratee_id || !relationship || !date_evaluated) {
    return res.status(400).json({
      message: "ratee_id, relationship, and date_evaluated are required.",
    });
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({
      message: "answers array is required and must not be empty.",
    });
  }
  if (!["peer", "subordinate", "superior"].includes(relationship)) {
    return res.status(400).json({
      message: "relationship must be peer, subordinate, or superior.",
    });
  }

  // ── 2. Resolve active period ─────────────────────────────────────────────────
  let periodId = bodyPeriodId;
  if (!periodId) {
    const { data: period, error: periodError } = await supabase
      .from("evaluation_periods")
      .select("id")
      .eq("is_active", true)
      .single();

    if (periodError || !period) {
      return res.status(404).json({ message: "No active evaluation period found." });
    }
    periodId = period.id;
  }

  // ── 3. Duplicate check ──────────────────────────────────────────────────────
  const { data: existing, error: dupError } = await supabase
    .from("submissions")
    .select("id")
    .eq("rater_id",     raterId)
    .eq("ratee_id",     ratee_id)
    .eq("period_id",    periodId)
    .eq("relationship", relationship)
    .eq("is_complete",  true)
    .maybeSingle();

  if (dupError) {
    console.error("❌ submitSurvey duplicate check:", dupError.message);
    return res.status(500).json({ message: "Database error." });
  }
  if (existing) {
    return res.status(409).json({
      message: "You have already submitted an evaluation for this person.",
    });
  }

  // ── 4. Fetch questions → build positional key map ───────────────────────────
  // Fetches all active questions for this relationship type,
  // joined with their category's sort_order to determine category number.
  const { data: dbQuestions, error: qError } = await supabase
    .from("questions")
    .select("id, text, sort_order, category_id, categories(sort_order)")
    .contains("applicable_roles", [relationship])
    .eq("is_active", true);

  if (qError) {
    console.error("❌ submitSurvey questions fetch:", qError.message);
    return res.status(500).json({ message: "Database error fetching questions." });
  }

  // Sort: category sort_order ASC, then question sort_order ASC
  dbQuestions.sort((a, b) => {
    const catDiff = (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0);
    return catDiff !== 0 ? catDiff : a.sort_order - b.sort_order;
  });

  // Map frontend string prefix to relationship
  // peer → "peer", subordinate → "subor", superior → "super"
  const prefixMap = { peer: "peer", subordinate: "subor", superior: "super" };
  const prefix    = prefixMap[relationship];

  // Group questions by category sort_order (= category number)
  const byCategory = {};
  for (const q of dbQuestions) {
    const catNum = q.categories?.sort_order ?? 0;
    if (!byCategory[catNum]) byCategory[catNum] = [];
    byCategory[catNum].push(q);
  }

  // Build position key → UUID map: "peer1.1" → UUID, "subor6.3" → UUID …
  const keyToUUID = {};
  for (const [catNum, questions] of Object.entries(byCategory)) {
    questions.forEach((q, idx) => {
      keyToUUID[`${prefix}${catNum}.${idx + 1}`] = q.id;
    });
  }

  // ── 5. Resolve each answer's question_id ────────────────────────────────────
  const resolvedAnswers = [];
  const unresolvedKeys  = [];

  for (const answer of answers) {
    const clientKey = String(answer.question_id ?? "").trim();
    let   realUUID  = null;

    if (keyToUUID[clientKey]) {
      // Positional key match ("peer1.1", "subor2.3", etc.)
      realUUID = keyToUUID[clientKey];
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientKey)) {
      // Already a valid UUID — use directly
      realUUID = clientKey;
    } else {
      unresolvedKeys.push(clientKey);
      continue;
    }

    resolvedAnswers.push({
      question_id: realUUID,
      score:       answer.is_na ? null : (typeof answer.score === "number" ? answer.score : null),
      is_na:       answer.is_na ?? false,
    });
  }

  if (unresolvedKeys.length > 0) {
    console.warn("⚠️  Unresolved question IDs (skipped):", unresolvedKeys);
  }
  if (resolvedAnswers.length === 0) {
    return res.status(400).json({
      message: "No valid answers could be matched to database questions. Check question IDs.",
      unresolved: unresolvedKeys,
    });
  }

  // ── 6. INSERT submission row (incomplete until answers saved) ───────────────
  const { data: submission, error: subInsertError } = await supabase
    .from("submissions")
    .insert({
      rater_id:       raterId,
      ratee_id:       ratee_id,
      period_id:      periodId,
      relationship:   relationship,
      date_evaluated: date_evaluated,
      is_complete:    false,
    })
    .select("id")
    .single();

  if (subInsertError) {
    // Race condition duplicate at DB level
    if (subInsertError.code === "23505") {
      return res.status(409).json({
        message: "You have already submitted an evaluation for this person.",
      });
    }
    console.error("❌ submitSurvey insert submission:", subInsertError.message);
    return res.status(500).json({ message: "Database error saving submission." });
  }

  const submissionId = submission.id;

  // ── 7. Bulk INSERT answers ──────────────────────────────────────────────────
  const answerRows = resolvedAnswers.map((a) => ({
    submission_id: submissionId,
    question_id:   a.question_id,
    score:         a.score,
    is_na:         a.is_na,
  }));

  const { error: answersError } = await supabase
    .from("answers")
    .insert(answerRows);

  if (answersError) {
    // Rollback: remove the incomplete submission so the user can retry
    await supabase.from("submissions").delete().eq("id", submissionId);
    console.error("❌ submitSurvey insert answers:", answersError.message);
    return res.status(500).json({
      message: "Database error saving answers. Your submission was not saved — please try again.",
    });
  }

  // ── 8. Mark submission complete ──────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("submissions")
    .update({ is_complete: true })
    .eq("id", submissionId);

  if (updateError) {
    // Non-fatal — answers are saved, just the flag didn't flip
    console.error("❌ submitSurvey update is_complete:", updateError.message);
  }

  // ── 9. Log comments (store in DB table when comments table is added) ────────
  if (comments && Object.keys(comments).length > 0) {
    console.log(`📝 Comments for submission ${submissionId}:`, JSON.stringify(comments));
  }

  console.log(`✅ Submission ${submissionId} saved — ${resolvedAnswers.length} answers`);

  return res.status(201).json({
    message:       "Survey submitted successfully.",
    submission_id: submissionId,
  });
}