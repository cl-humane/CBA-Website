// server/services/brevo.js
// Sends transactional emails via Brevo (formerly Sendinblue) REST API.
// Uses fetch (Node 18+) — no extra npm package needed.
//
// Required env vars:
//   BREVO_API_KEY   — your Brevo API key (Settings → SMTP & API → API Keys)
//   BREVO_FROM_EMAIL — sender address (must be verified in Brevo)
//   BREVO_FROM_NAME  — sender display name (optional, defaults to "CBA System")

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

/**
 * Send a single transactional email via Brevo.
 * @param {{ to: string, toName?: string, subject: string, html: string }} opts
 */
export async function sendEmail({ to, toName, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set in environment.");

  const payload = {
    sender: {
      email: process.env.BREVO_FROM_EMAIL ?? "noreply@pvpi.ph",
      name:  process.env.BREVO_FROM_NAME  ?? "CBA System",
    },
    to: [{ email: to, name: toName ?? to }],
    subject,
    htmlContent: html,
  };

  const res = await fetch(BREVO_API, {
    method:  "POST",
    headers: {
      "accept":       "application/json",
      "content-type": "application/json",
      "api-key":      apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Brevo error ${res.status}: ${err.message ?? JSON.stringify(err)}`);
  }

  return await res.json(); // { messageId: "..." }
}

/**
 * Send a registration code email.
 */
export async function sendRegistrationCode({ email, full_name, code }) {
  return sendEmail({
    to:      email,
    toName:  full_name,
    subject: "Your CBA Registration Code — Premier Value Provider Inc.",
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;background:#f5f6fa;padding:0;border-radius:12px;overflow:hidden">
        <div style="background:#1a3c6e;padding:28px 32px;text-align:center">
          <h1 style="color:#fff;font-size:1.3rem;margin:0;letter-spacing:0.02em">
            Premier Value Provider Inc.
          </h1>
          <p style="color:rgba(255,255,255,.7);font-size:0.85rem;margin:4px 0 0">
            Competency Based Assessment
          </p>
        </div>
        <div style="padding:32px;background:#fff">
          <p style="color:#333;font-size:1rem;margin:0 0 12px">
            Hello, <strong>${full_name}</strong> 👋
          </p>
          <p style="color:#555;font-size:0.95rem;line-height:1.6;margin:0 0 24px">
            Your account has been created by your administrator.
            Use the code below to complete your registration and set your password.
          </p>
          <div style="background:#f0f4ff;border:2px dashed #1a3c6e;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
            <p style="color:#888;font-size:0.78rem;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Your Registration Code</p>
            <span style="font-size:2.2rem;font-weight:800;letter-spacing:10px;color:#1a3c6e;font-family:monospace">
              ${code}
            </span>
          </div>
          <p style="color:#e65100;font-size:0.85rem;background:#fff3e0;padding:10px 14px;border-radius:8px;margin:0 0 24px">
            ⚠️ This code expires in <strong>7 days</strong> and can only be used once.
          </p>
          <p style="color:#999;font-size:0.82rem;line-height:1.6;margin:0">
            If you did not expect this email, please ignore it or contact your administrator.
          </p>
        </div>
        <div style="background:#f0f3fa;padding:16px 32px;text-align:center">
          <p style="color:#aaa;font-size:0.78rem;margin:0">
            © 2024 Premier Value Provider, Inc. All Rights Reserved.
          </p>
        </div>
      </div>
    `,
  });
}