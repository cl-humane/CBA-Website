// client/src/api/survey.js

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// ── Error class so the UI can show specific messages ──────────────────────────
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
  }
}

// ── GET helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, token) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Make sure the backend is running on port 5000.",
      0
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Server returned an unexpected response (${res.status}).`, res.status);
  }

  if (!res.ok) {
    throw new ApiError(data.message || `Request failed (${res.status}).`, res.status);
  }

  return data;
}

// ── POST helper ───────────────────────────────────────────────────────────────
async function apiPost(path, token, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Make sure the backend is running on port 5000.",
      0
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Server returned an unexpected response (${res.status}).`, res.status);
  }

  if (!res.ok) {
    throw new ApiError(data.message || `Request failed (${res.status}).`, res.status);
  }

  return data;
}

// ── GET /api/v1/survey/period ─────────────────────────────────────────────────
export function getActivePeriod(token) {
  return apiFetch("/api/v1/survey/period", token);
}

// ── GET /api/v1/survey/ratees?relationship=... ────────────────────────────────
// Returns all active users (except self) with is_submitted flag per relationship
export function getRatees(token, relationship) {
  return apiFetch(`/api/v1/survey/ratees?relationship=${relationship}`, token);
}

// ── GET /api/v1/survey/status?ratee_id=&relationship= ────────────────────────
// Returns { is_submitted: boolean }
// Call on Cat 1 mount to redirect raters who already submitted for this ratee.
export function getSurveyStatus(token, rateeId, relationship) {
  return apiFetch(
    `/api/v1/survey/status?ratee_id=${rateeId}&relationship=${relationship}`,
    token
  );
}

// ── POST /api/v1/survey/submit ────────────────────────────────────────────────
// Payload: {
//   ratee_id, relationship, period_id?, date_evaluated,
//   answers: [{ question_id, score, is_na }],
//   comments: { strengths, areas_of_improvement, development_goals?, done_rating_all? }
// }
// Returns: { message, submission_id }
export function submitSurvey(token, payload) {
  return apiPost("/api/v1/survey/submit", token, payload);
}