// client/src/api/admin.js
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

async function apiFetch(token, path, options = {}) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message ?? "Request failed"), { status: res.status });
  return data;
}

// ── Companies ──────────────────────────────────────────────────────────────────
export const getCompanies = (token) => apiFetch(token, "/admin/companies");

// addCompany accepts FormData (for logo upload) instead of plain JSON.
export async function addCompany(token, formData) {
  const res = await fetch(`${API_URL}/api/v1/admin/companies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message ?? "Request failed"), { status: res.status });
  return data;
}

// updateCompany accepts FormData (logo replacement is optional).
export async function updateCompany(token, id, formData) {
  const res = await fetch(`${API_URL}/api/v1/admin/companies/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message ?? "Request failed"), { status: res.status });
  return data;
}

// ── Evaluation Periods (scoped to a company) ──────────────────────────────────
export const getPeriods   = (token, companyId)     => apiFetch(token, `/admin/periods?company_id=${companyId}`);
export const addPeriod    = (token, payload)        => apiFetch(token, "/admin/periods", { method: "POST", body: JSON.stringify(payload) });
export const updatePeriod = (token, id, payload)   => apiFetch(token, `/admin/periods/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deletePeriod = (token, id)             => apiFetch(token, `/admin/periods/${id}`, { method: "DELETE" });

// ── Employees (scoped to a company) ───────────────────────────────────────────
export const getEmployees   = (token, companyId) => apiFetch(token, `/admin/employees?company_id=${companyId}`);
export const getDepartments = (token, companyId) => apiFetch(token, `/admin/departments?company_id=${companyId}`);
export const addEmployee    = (token, payload)   => apiFetch(token, "/admin/employees", { method: "POST", body: JSON.stringify(payload) });
export const resendCode     = (token, id)        => apiFetch(token, `/admin/employees/${id}/resend-code`, { method: "POST" });
export const toggleActive   = (token, id, val)   => apiFetch(token, `/admin/employees/${id}`, { method: "PUT", body: JSON.stringify({ is_active: val }) });

// PUT /api/v1/admin/employees/:id/relationships
export const updateRelationships = (token, id, relationships, period_id) =>
  apiFetch(token, `/admin/employees/${id}/relationships`, {
    method: "PUT",
    body: JSON.stringify({ relationships, period_id }),
  });

export async function bulkUpload(token, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/api/v1/admin/employees/bulk`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Bulk upload failed");
  return data;
}