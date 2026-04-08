// server/controllers/authController.js
import jwt                        from "jsonwebtoken";
import supabase, { supabaseAdmin } from "../config/supabase.js";

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export async function login(req, res) {
  const { email, password } = req.body;

  // 1. Validate input
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  console.log(`\n🔐 Login attempt: ${email}`);

  // 2. Authenticate with Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    console.error("❌ Supabase Auth error:", authError.message);

    const authErrorMap = {
      "Invalid login credentials": "Invalid email or password.",
      "Email not confirmed":       "Please verify your email before logging in.",
      "User not found":            "No account found with this email.",
      "Too many requests":         "Too many login attempts. Please wait and try again.",
    };

    const friendlyMessage =
      authErrorMap[authError.message] ??
      authError.message ??
      "Login failed. Please try again.";

    return res.status(401).json({ message: friendlyMessage });
  }

  if (!authData?.user) {
    console.error("❌ No user returned from Supabase Auth.");
    return res.status(401).json({ message: "Login failed. Please try again." });
  }

  console.log("✅ Supabase Auth OK — uid:", authData.user.id);

  const supabaseUid = authData.user.id;
  const dbClient    = supabaseAdmin ?? supabase;

  if (!supabaseAdmin) {
    console.warn(
      "⚠️  SUPABASE_SERVICE_ROLE_KEY not set — " +
      "falling back to anon client. RLS may block the users query."
    );
  }

  // 3. Fetch user row from public.users
  const { data: userRow, error: userError } = await dbClient
    .from("users")
    .select("id, full_name, email, role, company_id, department_id, is_active")
    .eq("id", supabaseUid)
    .single();

  if (userError) {
    console.error(
      "❌ users table error:",
      userError.message,
      "| code:", userError.code,
      "| details:", userError.details,
      "| hint:", userError.hint
    );

    const dbErrorMap = {
      PGRST116: `No user record found for uid=${supabaseUid}. ` +
                `Ask an admin to add you to the users table.`,
      "42501":  "Permission denied — check Supabase RLS policies or add the service role key.",
      "42P01":  "The 'users' table does not exist. Check your database schema.",
    };

    const friendlyMessage =
      dbErrorMap[userError.code] ??
      `Database error (${userError.code}): ${userError.message}`;

    return res.status(
      userError.code === "PGRST116" ? 404 : 500
    ).json({ message: friendlyMessage });
  }

  if (!userRow) {
    console.error("❌ Empty result from users table for uid:", supabaseUid);
    return res.status(404).json({
      message: "User record not found. Contact your administrator.",
    });
  }

  // 4. Check account is active
  if (!userRow.is_active) {
    console.warn("⚠️  Deactivated account:", email);
    return res.status(403).json({
      message: "Your account has been deactivated. Contact your administrator.",
    });
  }

  console.log(`✅ users table OK — role: ${userRow.role}, name: ${userRow.full_name}`);

  // 5. Sign JWT
  const token = jwt.sign(
    {
      sub:           userRow.id,
      email:         userRow.email,
      full_name:     userRow.full_name,
      role:          userRow.role,
      company_id:    userRow.company_id,
      department_id: userRow.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  console.log("✅ JWT signed — login successful\n");

  return res.status(200).json({
    token,
    user: {
      id:            userRow.id,
      full_name:     userRow.full_name,
      email:         userRow.email,
      role:          userRow.role,
      company_id:    userRow.company_id,
      department_id: userRow.department_id,
    },
  });
}

// ── LOGOUT ────────────────────────────────────────────────────────────────────
export async function logout(req, res) {
  try {
    await supabase.auth.signOut();
    return res.status(200).json({ message: "Logged out successfully." });
  } catch (err) {
    console.error("❌ Logout error:", err.message);
    return res.status(500).json({ message: "Logout failed." });
  }
}

// ── VERIFY CODE ───────────────────────────────────────────────────────────────
// POST /api/v1/auth/verify-code
// Body: { email, code }
// Step 1 of registration — checks code exists, matches email, not expired/used.
// Returns: { valid: true, full_name, role, company_name }
export async function verifyCode(req, res) {
  const { email, code } = req.body;

  if (!email?.trim() || !code?.trim()) {
    return res.status(400).json({ message: "Email and code are required." });
  }

  const dbClient = supabaseAdmin ?? supabase;

  const { data: record, error } = await dbClient
    .from("registration_codes")
    .select("id, status, expires_at, full_name, role, companies ( name )")
    .eq("email", email.trim().toLowerCase())
    .eq("code",  code.trim().toUpperCase())
    .single();

  if (error || !record) {
    return res.status(404).json({ message: "Invalid email or code. Please check and try again." });
  }

  if (record.status === "used") {
    return res.status(409).json({
      message: "This code has already been used. Please contact your administrator.",
    });
  }

  if (record.status === "expired" || new Date(record.expires_at) < new Date()) {
    // Auto-mark expired if not already
    await dbClient.from("registration_codes").update({ status: "expired" }).eq("id", record.id);
    return res.status(410).json({
      message: "This code has expired. Please contact your administrator to resend.",
    });
  }

  console.log(`✅ Code verified for ${email}`);

  return res.status(200).json({
    valid:        true,
    full_name:    record.full_name,
    role:         record.role,
    company_name: record.companies?.name ?? "",
  });
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
// Body: { email, code, password }
// Step 2 of registration — sets password, marks code as used, returns JWT.
export async function register(req, res) {
  const { email, code, password } = req.body;

  if (!email?.trim() || !code?.trim() || !password) {
    return res.status(400).json({ message: "Email, code, and password are required." });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  const dbClient = supabaseAdmin ?? supabase;

  // 1. Re-validate code (prevent race conditions)
  const { data: record, error: codeError } = await dbClient
    .from("registration_codes")
    .select("id, status, expires_at, user_id")
    .eq("email", email.trim().toLowerCase())
    .eq("code",  code.trim().toUpperCase())
    .single();

  if (codeError || !record) {
    return res.status(404).json({ message: "Invalid email or code." });
  }
  if (record.status === "used") {
    return res.status(409).json({ message: "This code has already been used." });
  }
  if (record.status === "expired" || new Date(record.expires_at) < new Date()) {
    return res.status(410).json({ message: "This code has expired. Contact your administrator." });
  }
  if (!record.user_id) {
    return res.status(500).json({
      message: "Registration code is not linked to a user. Contact your administrator.",
    });
  }

  // 2. Update the Supabase Auth user's password
  const { error: pwError } = await dbClient.auth.admin.updateUserById(record.user_id, {
    password,
    email_confirm: true,
  });

  if (pwError) {
    console.error("❌ register updateUserById:", pwError.message);
    return res.status(500).json({ message: "Failed to set password. Please try again." });
  }

  // 3. Mark code as used
  await dbClient
    .from("registration_codes")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", record.id);

  // 4. Fetch user row for JWT
  const { data: userRow, error: userError } = await dbClient
    .from("users")
    .select("id, full_name, email, role, company_id, department_id, is_active")
    .eq("id", record.user_id)
    .single();

  if (userError || !userRow) {
    // Password was set but we can't build a JWT — user can log in manually
    return res.status(200).json({
      message:    "Registration complete! Please log in with your new password.",
      auto_login: false,
    });
  }

  // 5. Sign JWT for immediate auto-login
  const token = jwt.sign(
    {
      sub:           userRow.id,
      email:         userRow.email,
      full_name:     userRow.full_name,
      role:          userRow.role,
      company_id:    userRow.company_id,
      department_id: userRow.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  console.log(`✅ Registration complete for ${email}`);

  return res.status(201).json({
    message:    "Registration complete! Welcome to CBA.",
    auto_login: true,
    token,
    user: {
      id:            userRow.id,
      full_name:     userRow.full_name,
      email:         userRow.email,
      role:          userRow.role,
      company_id:    userRow.company_id,
      department_id: userRow.department_id,
    },
  });
}