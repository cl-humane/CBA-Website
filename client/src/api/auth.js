// client/src/api/auth.js
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function login({ email, password }) {
  let res, data;

  try {
    res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
  } catch (networkErr) {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running on port 5000."
    );
  }

  try {
    data = await res.json();
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }

  if (!res.ok) {
    const fallback = {
      400: "Missing email or password.",
      401: "Invalid email or password.",
      403: "Your account has been deactivated.",
      404: "Account not fully set up. Contact your administrator.",
      500: "Server error. Please try again later.",
    };
    throw new Error(data?.message ?? fallback[res.status] ?? "Login failed.");
  }

  return data; // { token, user }
}

export async function logout(token) {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    console.warn("Logout request failed (network error).");
  }
}

// ── VERIFY CODE ───────────────────────────────────────────────────────────────
// Step 1 of registration: validate email + code
// Returns { valid, full_name, role, company_name }
export async function verifyCode({ email, code }) {
  let res, data;

  try {
    res = await fetch(`${API_URL}/api/v1/auth/verify-code`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, code }),
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running on port 5000."
    );
  }

  try {
    data = await res.json();
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }

  if (!res.ok) {
    const fallback = {
      400: "Email and code are required.",
      404: "Invalid email or code. Please check and try again.",
      409: "This code has already been used. Contact your administrator.",
      410: "This code has expired. Contact your administrator to resend.",
      500: "Server error. Please try again later.",
    };
    throw new Error(data?.message ?? fallback[res.status] ?? "Verification failed.");
  }

  return data; // { valid, full_name, role, company_name }
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
// Step 2 of registration: set password, mark code as used
// Returns { message, auto_login, token?, user? }
export async function register({ email, code, password }) {
  let res, data;

  try {
    res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, code, password }),
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running on port 5000."
    );
  }

  try {
    data = await res.json();
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }

  if (!res.ok) {
    const fallback = {
      400: "Email, code, and password are required.",
      404: "Invalid email or code.",
      409: "This code has already been used.",
      410: "This code has expired. Contact your administrator.",
      500: "Server error. Please try again later.",
    };
    throw new Error(data?.message ?? fallback[res.status] ?? "Registration failed.");
  }

  return data; // { message, auto_login, token?, user? }
}