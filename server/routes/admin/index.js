// server/routes/admin/index.js
// Mounts all admin sub-routes under /api/v1/admin
// All routes here require: authenticated + role === 'admin'

import { Router } from "express";
import multer from "multer";
import authenticate, { requireAdmin } from "../../middleware/auth.js";
import bulkUpload from "./bulkUpload.js";
import { supabaseAdmin } from "../../config/supabase.js";

const router = Router();
const db = supabaseAdmin; // service-role client, bypasses RLS

router.use(authenticate);
router.use(requireAdmin);

// ── Syncs companies.is_active based on whether it has any active evaluation period
const syncCompanyActiveStatus = async (companyId) => {
  const { count } = await db
    .from("evaluation_periods")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_active", true);

  await db
    .from("companies")
    .update({ is_active: count > 0 })
    .eq("id", companyId);
};

// ── Logo upload (multer — stores to /public/logos/) ────────────────────────────

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpg", "image/jpeg", "image/webp", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files allowed."));
  },
});

const extractStoragePath = (publicUrl) => {
  if (!publicUrl) return null;
  const parts = publicUrl.split("/storage/v1/object/public/company-logo/");
  return parts[1] || null;
};

const uploadLogo = async (file, companyId) => {
  const ext = file.originalname.split(".").pop();
  const fileName = `companies/${companyId}/logo-${Date.now()}.${ext}`;

  const { error } = await db.storage
    .from("company-logo")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw error;

  const { data } = db.storage.from("company-logo").getPublicUrl(fileName);
  return { url: data.publicUrl, path: fileName };
};

const deleteLogo = async (publicUrl) => {
  const path = extractStoragePath(publicUrl);
  if (!path) return;
  await db.storage.from("company-logo").remove([path]);
};

// ── Bulk upload — must be before :id routes ────────────────────────────────────
router.use("/employees/bulk", bulkUpload);

// =============================================================================
// COMPANIES
// =============================================================================

// GET /api/v1/admin/companies
router.get("/companies", async (req, res) => {
  const { data, error } = await db
    .from("companies")
    .select("id, name, address, contact_name, contact_email, logo_url, is_active, created_at")
    .order("name");

  if (error) return res.status(500).json({ message: error.message });
  res.json({ companies: data });
});

// POST /api/v1/admin/companies
// Accepts multipart/form-data so the logo file can be included.
router.post("/companies", logoUpload.single("logo"), async (req, res) => {
  const {
    name, address, contact_name, contact_email,
    period_label, period_start_date, period_end_date, period_deadline_date,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: "Company name is required." });
  }

  let uploadedLogo = null;

  try {
    // 1. Create company FIRST (so we get ID for folder structure)
    const { data: company, error: companyErr } = await db
      .from("companies")
      .insert({
        name: name.trim(),
        address,
        contact_name,
        contact_email,
        logo_url: null,
      })
      .select("id, name, logo_url")
      .single();

    if (companyErr) {
      return res.status(500).json({ message: companyErr.message });
    }

    // 2. Upload logo (if exists)
    if (req.file) {
      uploadedLogo = await uploadLogo(req.file, company.id);

      const { error: updateErr } = await db
        .from("companies")
        .update({ logo_url: uploadedLogo.url })
        .eq("id", company.id);

      if (updateErr) {
        await deleteLogo(uploadedLogo.url);
        throw updateErr;
      }

      company.logo_url = uploadedLogo.url;
    }

    // 3. Evaluation period (optional)
    let period = null;
    if (period_label && period_start_date && period_end_date && period_deadline_date) {
      const { data: newPeriod, error: periodErr } = await db
        .from("evaluation_periods")
        .insert({
          company_id: company.id,
          label: period_label.trim(),
          start_date: period_start_date,
          end_date: period_end_date,
          deadline_date: period_deadline_date,
          is_active: false,
        })
        .select("id, label, start_date, end_date, deadline_date, is_active")
        .single();

      if (!periodErr) period = newPeriod;
    }

    return res.status(201).json({
      message: "Company created.",
      company,
      period: period ?? null,
    });

  } catch (err) {
    if (uploadedLogo?.url) {
      await deleteLogo(uploadedLogo.url);
    }
    return res.status(500).json({
      message: err.message || "Failed to create company",
    });
  }
});

// PUT /api/v1/admin/companies/:id
// Accepts multipart/form-data (logo optional). Updates company details.
router.put("/companies/:id", logoUpload.single("logo"), async (req, res) => {
  const { id } = req.params;
  const { name, address, contact_name, contact_email } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: "Company name is required." });
  }

  try {
    // 1. Fetch existing company (need current logo_url for cleanup)
    const { data: existing, error: fetchErr } = await db
      .from("companies")
      .select("id, logo_url")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ message: "Company not found." });
    }

    const updates = {
      name: name.trim(),
      address: address ?? null,
      contact_name: contact_name ?? null,
      contact_email: contact_email ?? null,
    };

    // 2. Upload new logo if provided
    let uploadedLogo = null;
    if (req.file) {
      uploadedLogo = await uploadLogo(req.file, id);
      updates.logo_url = uploadedLogo.url;
    }

    // 3. Update DB
    const { data: company, error: updateErr } = await db
      .from("companies")
      .update(updates)
      .eq("id", id)
      .select("id, name, address, contact_name, contact_email, logo_url, is_active")
      .single();

    if (updateErr) {
      if (uploadedLogo?.url) await deleteLogo(uploadedLogo.url);
      return res.status(500).json({ message: updateErr.message });
    }

    // 4. Delete old logo after successful DB update
    if (req.file && existing.logo_url) {
      await deleteLogo(existing.logo_url);
    }

    return res.json({ message: "Company updated.", company });

  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update company." });
  }
});

// PUT /api/v1/admin/companies/:id/logo
router.put("/companies/:id/logo", logoUpload.single("logo"), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "Logo file is required." });
  }

  try {
    const { data: company, error: fetchErr } = await db
      .from("companies")
      .select("id, logo_url")
      .eq("id", id)
      .single();

    if (fetchErr || !company) {
      return res.status(404).json({ message: "Company not found." });
    }

    const uploadedLogo = await uploadLogo(req.file, id);
    const newLogoUrl = uploadedLogo.url;
    const uploadedPath = uploadedLogo.path;

    const { error: updateErr } = await db
      .from("companies")
      .update({ logo_url: newLogoUrl })
      .eq("id", id);

    if (updateErr) {
      await db.storage.from("company-logo").remove([uploadedPath]);
      return res.status(500).json({ message: updateErr.message });
    }

    if (company.logo_url) {
      const oldPath = extractStoragePath(company.logo_url);
      if (oldPath) {
        await db.storage.from("company-logo").remove([oldPath]);
      }
    }

    return res.json({
      message: "Logo updated successfully.",
      logo_url: newLogoUrl,
    });

  } catch (err) {
    return res.status(500).json({
      message: err.message || "Failed to update logo",
    });
  }
});

// =============================================================================
// EVALUATION PERIODS  (scoped by company_id)
// =============================================================================

// GET /api/v1/admin/periods?company_id=
router.get("/periods", async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ message: "company_id is required." });

  const { data, error } = await db
    .from("evaluation_periods")
    .select("id, label, start_date, end_date, deadline_date, is_active, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  res.json({ periods: data });
});

// POST /api/v1/admin/periods
router.post("/periods", async (req, res) => {
  const { company_id, label, start_date, end_date, deadline_date } = req.body;

  if (!company_id || !label?.trim() || !start_date || !end_date || !deadline_date) {
    return res.status(400).json({
      message: "company_id, label, start_date, end_date, and deadline_date are required.",
    });
  }

  const { data, error } = await db
    .from("evaluation_periods")
    .insert({
      company_id,
      label: label.trim(),
      start_date,
      end_date,
      deadline_date,
      is_active: false,
    })
    .select("id, label, start_date, end_date, deadline_date, is_active")
    .single();

  if (error) return res.status(500).json({ message: error.message });
  res.status(201).json({ message: "Period created.", period: data });
});

// PUT /api/v1/admin/periods/:id
router.put("/periods/:id", async (req, res) => {
  const { id } = req.params;
  const { label, start_date, end_date, deadline_date, is_active } = req.body;

  const { data: existing, error: fetchErr } = await db
    .from("evaluation_periods")
    .select("id, company_id, is_active")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ message: "Evaluation period not found." });
  }

  if (is_active === true) {
    await db
      .from("evaluation_periods")
      .update({ is_active: false })
      .eq("company_id", existing.company_id)
      .neq("id", id);
  }

  const updates = {};
  if (label !== undefined) updates.label = label.trim();
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (deadline_date !== undefined) updates.deadline_date = deadline_date;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await db
    .from("evaluation_periods")
    .update(updates)
    .eq("id", id)
    .select("id, label, start_date, end_date, deadline_date, is_active")
    .single();

  if (error) return res.status(500).json({ message: error.message });

  await syncCompanyActiveStatus(existing.company_id);

  res.json({ message: "Period updated.", period: data });
});

// DELETE /api/v1/admin/periods/:id
router.delete("/periods/:id", async (req, res) => {
  const { id } = req.params;

  // Fetch first so we have company_id for the sync after deletion
  const { data: period, error: fetchErr } = await db
    .from("evaluation_periods")
    .select("id, company_id")
    .eq("id", id)
    .single();

  if (fetchErr || !period) {
    return res.status(404).json({ message: "Evaluation period not found." });
  }

  const { count } = await db
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("period_id", id);

  if (count > 0) {
    return res.status(409).json({
      message: `Cannot delete a period that has ${count} submission(s). Deactivate it instead.`,
    });
  }

  const { error } = await db.from("evaluation_periods").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });

  await syncCompanyActiveStatus(period.company_id);

  res.json({ message: "Period deleted." });
});

// =============================================================================
// DEPARTMENTS  (scoped by company_id)
// =============================================================================

// GET /api/v1/admin/departments?company_id=
router.get("/departments", async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ message: "company_id is required." });

  const { data, error } = await db
    .from("departments")
    .select("id, name")
    .eq("company_id", company_id)
    .order("name");

  if (error) return res.status(500).json({ message: error.message });
  res.json({ departments: data });
});

// =============================================================================
// EMPLOYEES  (scoped by company_id)
// =============================================================================

// GET /api/v1/admin/employees?company_id=
router.get("/employees", async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ message: "company_id is required." });

  const { data, error } = await db
    .from("users")
    .select(`
      id, full_name, email, role, is_active,
      departments (name),
      registration_codes (status)
    `)
    .eq("company_id", company_id)
    .order("full_name");

  if (error) return res.status(500).json({ message: error.message });

  const { data: activePeriod } = await db
    .from("evaluation_periods")
    .select("id")
    .eq("company_id", company_id)
    .eq("is_active", true)
    .maybeSingle();

  let relMap = {};
  if (activePeriod) {
    const userIds = data.map(u => u.id);
    const { data: assignments } = await db
      .from('ratee_rater_assignments')
      .select('rater_id, ratee_id, relationship')
      .eq('period_id', activePeriod.id);

    for (const a of (assignments ?? [])) {
      if (userIds.includes(a.rater_id)) {
        if (!relMap[a.rater_id]) relMap[a.rater_id] = new Set();
        relMap[a.rater_id].add(a.relationship);
      }
      if (userIds.includes(a.ratee_id)) {
        if (!relMap[a.ratee_id]) relMap[a.ratee_id] = new Set();
        relMap[a.ratee_id].add(a.relationship);
      }
    }
  }

  const employees = data.map(u => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    department_name: u.departments?.name ?? null,
    code_status: u.registration_codes?.at(-1)?.status ?? null,
    relationships: relMap[u.id] ? [...relMap[u.id]] : [],
    active_period_id: activePeriod?.id ?? null,
  }));

  res.json({ employees, active_period_id: activePeriod?.id ?? null });
});

// POST /api/v1/admin/employees
router.post("/employees", async (req, res) => {
  const {
    last_name, first_name, middle_name,
    email, role = "employee",
    department_id, company_id,
    relationships = [],
  } = req.body;

  if (!last_name?.trim() || !first_name?.trim() || !email?.trim()) {
    return res.status(400).json({ message: "last_name, first_name, and email are required." });
  }
  if (!company_id) return res.status(400).json({ message: "company_id is required." });

  const crypto = await import("crypto");
  const { sendRegistrationCode } = await import("../../services/brevo.js");

  const tempPassword = crypto.default.randomBytes(16).toString("base64");
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (authErr) return res.status(400).json({ message: authErr.message });

  const userId = authData.user.id;

  const { error: userErr } = await db.from("users").insert({
    id: userId,
    company_id,
    department_id: department_id || null,
    email,
    last_name: last_name.trim().toUpperCase(),
    first_name: first_name.trim().toUpperCase(),
    middle_name: middle_name?.trim().toUpperCase() || null,
    full_name: "",
    role,
  });

  if (userErr) {
    await db.auth.admin.deleteUser(userId);
    return res.status(500).json({ message: userErr.message });
  }

  const code = crypto.default.randomBytes(4).toString("hex").toUpperCase();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.from("registration_codes").insert({
    company_id, user_id: userId, email,
    last_name: last_name.trim().toUpperCase(),
    first_name: first_name.trim().toUpperCase(),
    middle_name: middle_name?.trim().toUpperCase() || null,
    full_name: "",
    role, department_id: department_id || null,
    code, status: "pending", expires_at: expires,
  });

  const mi = middle_name?.trim() ? ` ${middle_name.trim()[0].toUpperCase()}.` : "";
  const fullName = `${last_name.trim().toUpperCase()}, ${first_name.trim().toUpperCase()}${mi}`;
  try {
    await sendRegistrationCode({ email, full_name: fullName, code });
  } catch (mailErr) {
    console.warn("Brevo email failed for", email, "—", mailErr.message);
  }

  let assignmentsCreated = 0;
  const validRelationships = ["peer", "subordinate", "superior"];
  const chosenRels = relationships.filter(r => validRelationships.includes(r));

  if (chosenRels.length > 0) {
    const { data: activePeriod } = await db
      .from("evaluation_periods")
      .select("id")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .maybeSingle();

    if (activePeriod) {
      const { data: existingAssignments } = await db
        .from("ratee_rater_assignments")
        .select("rater_id, ratee_id, relationship")
        .eq("period_id", activePeriod.id);

      const assignmentRows = [];

      for (const relType of chosenRels) {
        const existing = existingAssignments ?? [];
        const memberSet = new Set();
        for (const a of existing) {
          if (a.relationship === relType) {
            memberSet.add(a.rater_id);
            memberSet.add(a.ratee_id);
          }
        }
        memberSet.delete(userId);
        const existingMembers = [...memberSet];

        for (const rateeId of existingMembers) {
          assignmentRows.push({ period_id: activePeriod.id, rater_id: userId, ratee_id: rateeId, relationship: relType });
        }
        for (const raterId of existingMembers) {
          assignmentRows.push({ period_id: activePeriod.id, rater_id: raterId, ratee_id: userId, relationship: relType });
        }
      }

      if (assignmentRows.length > 0) {
        const { error: aErr } = await db
          .from("ratee_rater_assignments")
          .upsert(assignmentRows, { onConflict: "period_id,rater_id,ratee_id,relationship", ignoreDuplicates: true });

        if (aErr) {
          console.error("Assignment insert error:", aErr.message);
        } else {
          assignmentsCreated = assignmentRows.length;
        }
      }
    }
  }

  res.status(201).json({
    message: "Employee added and registration code sent.",
    id: userId,
    assignments_created: assignmentsCreated,
  });
});

// PUT /api/v1/admin/employees/:id/relationships
router.put('/employees/:id/relationships', async (req, res) => {
  const { id } = req.params;
  const { relationships = [], period_id } = req.body;

  if (!period_id) return res.status(400).json({ message: 'period_id is required.' });

  const validRelationships = ['peer', 'subordinate', 'superior'];
  const chosenRels = relationships.filter(r => validRelationships.includes(r));

  await db.from('ratee_rater_assignments').delete().eq('period_id', period_id).eq('rater_id', id);
  await db.from('ratee_rater_assignments').delete().eq('period_id', period_id).eq('ratee_id', id);

  if (chosenRels.length === 0) {
    return res.json({ message: 'Relationships cleared.', assignments_created: 0, chosen_relationships: [] });
  }

  const { data: remainingAssignments } = await db
    .from('ratee_rater_assignments')
    .select('rater_id, ratee_id, relationship')
    .eq('period_id', period_id);

  const assignmentRows = [];

  for (const relType of chosenRels) {
    const memberSet = new Set();
    for (const a of (remainingAssignments ?? [])) {
      if (a.relationship === relType) {
        memberSet.add(a.rater_id);
        memberSet.add(a.ratee_id);
      }
    }
    memberSet.delete(id);
    const existingMembers = [...memberSet];

    for (const otherId of existingMembers) {
      assignmentRows.push({ period_id, rater_id: id, ratee_id: otherId, relationship: relType });
      assignmentRows.push({ period_id, rater_id: otherId, ratee_id: id, relationship: relType });
    }
  }

  let assignmentsCreated = 0;
  if (assignmentRows.length > 0) {
    const seen = new Set();
    const dedupedRows = assignmentRows.filter(row => {
      const key = row.rater_id + '|' + row.ratee_id + '|' + row.relationship;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { error: aErr } = await db
      .from('ratee_rater_assignments')
      .upsert(dedupedRows, { onConflict: 'period_id,rater_id,ratee_id,relationship', ignoreDuplicates: true });

    if (aErr) {
      console.error('Assignment upsert error:', aErr.message);
      return res.status(500).json({ message: 'Failed to save assignments.' });
    }
    assignmentsCreated = dedupedRows.length;
  }

  res.json({
    message: 'Relationships updated.',
    assignments_created: assignmentsCreated,
    chosen_relationships: chosenRels,
  });
});

// POST /api/v1/admin/employees/:id/resend-code
router.post("/employees/:id/resend-code", async (req, res) => {
  const { id } = req.params;

  const { data: codeRow, error: fetchErr } = await db
    .from("registration_codes")
    .select("id, email, full_name, code, status")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !codeRow) {
    return res.status(404).json({ message: "No registration code found for this employee." });
  }
  if (codeRow.status === "used") {
    return res.status(409).json({ message: "This employee has already registered." });
  }

  const crypto = await import("crypto");
  const { sendRegistrationCode } = await import("../../services/brevo.js");

  const newCode = crypto.default.randomBytes(4).toString("hex").toUpperCase();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.from("registration_codes").update({
    code: newCode,
    status: "pending",
    expires_at: newExpiry,
    used_at: null,
  }).eq("id", codeRow.id);

  try {
    await sendRegistrationCode({
      email: codeRow.email,
      full_name: codeRow.full_name,
      code: newCode,
    });
    res.status(200).json({ message: "Registration code resent successfully." });
  } catch (mailErr) {
    console.error("Brevo resend failed:", mailErr.message);
    res.status(500).json({ message: "Code updated but email failed to send." });
  }
});

// PUT /api/v1/admin/employees/:id
router.put("/employees/:id", async (req, res) => {
  const { is_active } = req.body;
  const { error } = await db.from("users").update({ is_active }).eq("id", req.params.id);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ message: "Employee updated." });
});

export default router;