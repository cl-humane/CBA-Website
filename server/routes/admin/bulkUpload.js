// server/routes/admin/bulkUpload.js
// POST /api/v1/admin/employees/bulk
//
// Template columns:
//   No. | last_name | first_name | middle_name | email | role | department | assignment
//
// `assignment` — dropdown or free text, separator can be comma OR plus (+).
//   Valid values: peer, subordinate, superior  (or "all" as shorthand for all three)
//   Examples: "All" | "peer" | "peer+subordinate" | "peer, subordinate"
//
// After all users are created, the upload automatically inserts ratee_rater_assignments:
//   For each relationship type → pair every rater who has that type with ALL other
//   employees in this upload who also share that same type (full cross-product),
//   AND cross-pair with existing members already in the period.

import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendRegistrationCode } from "../../services/brevo.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const VALID_RELATIONSHIPS = ["peer", "subordinate", "superior"];

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// Parse the `assignment` field into an array of valid relationship strings.
// Accepts comma-separated ("peer, subordinate") OR plus-separated ("peer+subordinate").
// "all" expands to all three types. Unrecognised values are ignored.
function parseRelationships(raw) {
  if (!raw) return [];
  const cleaned = String(raw).trim().toLowerCase();
  if (cleaned === "all" || cleaned === "peer+subordinate+superior") return VALID_RELATIONSHIPS;
  // Split on either comma or plus
  return cleaned
    .split(/[,+]/)
    .map(r => r.trim())
    .filter(r => VALID_RELATIONSHIPS.includes(r));
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const headerRowIdx = allRows.findIndex(row =>
    row.some(cell => typeof cell === "string" && cell.toLowerCase() === "last_name")
  );

  if (headerRowIdx === -1) {
    throw new Error("Could not find header row. Make sure your file uses the provided template.");
  }

  const headers  = allRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
  const dataRows = allRows.slice(headerRowIdx + 1);

  const employees = [];
  for (const row of dataRows) {
    if (row.every(cell => cell === "" || cell === null || cell === undefined)) continue;

    const obj = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });

    if (!obj.last_name || !obj.first_name || !obj.email) continue;

    // Skip the example/hint row (row 5 in the template has "UPPERCASE" as last_name)
    if (obj.last_name.toLowerCase() === "uppercase") continue;

    employees.push({
      last_name:     obj.last_name.toUpperCase(),
      first_name:    obj.first_name.toUpperCase(),
      middle_name:   obj.middle_name ? obj.middle_name.toUpperCase() : null,
      email:         obj.email.toLowerCase(),
      role:          (obj.role ?? "employee").toLowerCase() === "admin" ? "admin" : "employee",
      department:    obj.department ? obj.department.trim() : null,
      // Read from "assignment" column (supports both comma and + separators)
      relationships: parseRelationships(obj.assignment ?? ""),
    });
  }

  return employees;
}

// ── Route handler ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/employees/bulk
// Auth: Bearer token (admin only — enforced by authMiddleware upstream)
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded. Please attach an .xlsx file." });
  }

  let rows;
  try {
    rows = parseExcel(req.file.buffer);
  } catch (err) {
    return res.status(422).json({ message: err.message });
  }

  if (rows.length === 0) {
    return res.status(422).json({ message: "No valid employee rows found in the file." });
  }

  const supabase  = getSupabase();
  const companyId = req.user?.company_id;
  if (!companyId) {
    return res.status(403).json({ message: "Company context missing from token." });
  }

  // Pre-fetch departments
  const { data: deptRows } = await supabase
    .from("departments")
    .select("id, name")
    .eq("company_id", companyId);

  const deptMap = {};
  (deptRows ?? []).forEach(d => { deptMap[d.name.toLowerCase()] = d.id; });

  // Get active evaluation period
  const { data: activePeriod } = await supabase
    .from("evaluation_periods")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const added          = [];
  const skipped        = [];
  const email_failures = [];

  // email → { userId, relationships[] }
  const createdUsers = {};

  // ── Pass 1: create users ──────────────────────────────────────────────────
  for (const emp of rows) {
    try {
      const tempPassword = crypto.randomBytes(12).toString("base64");
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: emp.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authErr) {
        skipped.push(`${emp.email} — ${authErr.message}`);
        continue;
      }

      const userId = authData.user.id;

      // Resolve / auto-create department
      let departmentId = null;
      if (emp.department) {
        const key = emp.department.toLowerCase();
        if (deptMap[key]) {
          departmentId = deptMap[key];
        } else {
          const { data: newDept, error: deptErr } = await supabase
            .from("departments")
            .insert({ company_id: companyId, name: emp.department })
            .select("id")
            .single();
          if (!deptErr && newDept) {
            departmentId = newDept.id;
            deptMap[key] = newDept.id;
          }
        }
      }

      // Insert into public.users
      const { error: userErr } = await supabase.from("users").insert({
        id:            userId,
        company_id:    companyId,
        department_id: departmentId,
        email:         emp.email,
        last_name:     emp.last_name,
        first_name:    emp.first_name,
        middle_name:   emp.middle_name,
        role:          emp.role,
        full_name:     "",
      });

      if (userErr) {
        await supabase.auth.admin.deleteUser(userId);
        skipped.push(`${emp.email} — ${userErr.message}`);
        continue;
      }

      // Create registration code
      const code    = generateCode();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from("registration_codes").insert({
        company_id:    companyId,
        user_id:       userId,
        email:         emp.email,
        last_name:     emp.last_name,
        first_name:    emp.first_name,
        middle_name:   emp.middle_name,
        full_name:     "",
        role:          emp.role,
        department_id: departmentId,
        code,
        status:        "pending",
        expires_at:    expires,
      });

      // Send email
      const mi       = emp.middle_name ? ` ${emp.middle_name[0]}.` : "";
      const fullName = `${emp.last_name}, ${emp.first_name}${mi}`;
      try {
        await sendRegistrationCode({ email: emp.email, full_name: fullName, code });
      } catch (mailErr) {
        console.warn("⚠️  Brevo failed for", emp.email, "—", mailErr.message);
        email_failures.push(emp.email);
      }

      added.push(emp.email);
      createdUsers[emp.email] = { userId, relationships: emp.relationships };

    } catch (err) {
      console.error("Unexpected error for", emp.email, err);
      skipped.push(`${emp.email} — unexpected error`);
    }
  }

  // ── Pass 2: build ratee_rater_assignments ─────────────────────────────────
  let assignmentsInserted = 0;

  if (activePeriod) {
    // Fetch existing assignments already in the DB for this period
    const { data: existingAssignments } = await supabase
      .from("ratee_rater_assignments")
      .select("rater_id, ratee_id, relationship")
      .eq("period_id", activePeriod.id);

    const relationshipMap = { peer: [], subordinate: [], superior: [] };

    for (const { userId, relationships } of Object.values(createdUsers)) {
      for (const rel of relationships) {
        if (VALID_RELATIONSHIPS.includes(rel)) {
          relationshipMap[rel].push(userId);
        }
      }
    }

    const assignmentRows = [];

    for (const relType of VALID_RELATIONSHIPS) {
      const newMembers = relationshipMap[relType];
      if (newMembers.length === 0) continue;

      // Collect existing members of this relationship type from DB
      const existing = existingAssignments ?? [];
      const existingMemberSet = new Set();
      for (const a of existing) {
        if (a.relationship === relType) {
          existingMemberSet.add(a.rater_id);
          existingMemberSet.add(a.ratee_id);
        }
      }
      // Remove new users from existing set to avoid duplication
      for (const uid of newMembers) existingMemberSet.delete(uid);
      const existingMembers = [...existingMemberSet];

      // Among new users: full cross-product (everyone rates everyone)
      for (const raterId of newMembers) {
        for (const rateeId of newMembers) {
          if (raterId === rateeId) continue;
          assignmentRows.push({
            period_id:    activePeriod.id,
            rater_id:     raterId,
            ratee_id:     rateeId,
            relationship: relType,
          });
        }
      }

      // New users ↔ existing users: bidirectional pairing
      for (const newUserId of newMembers) {
        for (const existingUserId of existingMembers) {
          assignmentRows.push({
            period_id:    activePeriod.id,
            rater_id:     newUserId,
            ratee_id:     existingUserId,
            relationship: relType,
          });
          assignmentRows.push({
            period_id:    activePeriod.id,
            rater_id:     existingUserId,
            ratee_id:     newUserId,
            relationship: relType,
          });
        }
      }
    }

    if (assignmentRows.length > 0) {
      const { error: aErr } = await supabase
        .from("ratee_rater_assignments")
        .upsert(assignmentRows, {
          onConflict:       "period_id,rater_id,ratee_id,relationship",
          ignoreDuplicates: true,
        });

      if (aErr) {
        console.error("❌ Assignment insert error:", aErr.message);
      } else {
        assignmentsInserted = assignmentRows.length;
      }
    }
  }

  return res.status(200).json({
    message: `Bulk upload complete. ${added.length} added, ${skipped.length} skipped, ${assignmentsInserted} assignments created.`,
    added:               added.length,
    skipped,
    email_failures,
    assignments_created: assignmentsInserted,
    no_active_period:    !activePeriod,
  });
});

export default router;