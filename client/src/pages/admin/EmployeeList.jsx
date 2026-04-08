// client/src/pages/admin/EmployeeList.jsx
// Route: /admin/employees
//
// Two-panel flow (same page, no route change):
//   VIEW 1 — Company List  : shows all companies as cards, "Add Company" button
//   VIEW 2 — Employee List : drills into one company, breadcrumb to go back
//
// Add Company modal now includes:
//   - Company logo upload (optional, image file)
//   - Evaluation period section (optional but recommended)
//
// Periods panel is shown inside the Employee List view so admins can manage
// periods without leaving the page.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useSurveyStore from "../../store/surveyStore";
import {
  getCompanies, addCompany, updateCompany,
  getEmployees, getDepartments,
  addEmployee, resendCode, toggleActive, bulkUpload,
  updateRelationships,
  getPeriods, addPeriod, updatePeriod, deletePeriod,
} from "../../api/admin";
import "../../assets/admin/EmployeeList.css";

const pvpLogo = "/pvp.png";

const REL_CONFIG = {
  peer: { label: "Peer", color: "#1565c0", bg: "#E3F2FD" },
  subordinate: { label: "Subordinate", color: "#6a1b9a", bg: "#F3E5F5" },
  superior: { label: "Superior", color: "#e65100", bg: "#FFF3E0" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function CodeBadge({ status }) {
  const map = { pending: "Pending", used: "Used", expired: "Expired", none: "No Code" };
  return (
    <span className={`code-badge code-badge--${status ?? "none"}`}>
      {map[status] ?? "No Code"}
    </span>
  );
}

const ALL_RELS = ["peer", "subordinate", "superior"];

function RelBadges({ relationships }) {
  if (!relationships || relationships.length === 0) {
    return <span style={{ color: "#aaa", fontSize: "12px" }}>None</span>;
  }
  const hasAll = ALL_RELS.every(r => relationships.includes(r));
  if (hasAll) {
    return (
      <span style={{
        fontSize: "11px", fontWeight: 700, padding: "2px 10px",
        borderRadius: "10px", color: "#fff", background: "#1a1a2e",
      }}>
        All
      </span>
    );
  }
  return (
    <span style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
      {relationships.map(rel => {
        const cfg = REL_CONFIG[rel];
        if (!cfg) return null;
        return (
          <span key={rel} style={{
            fontSize: "11px", fontWeight: 600, padding: "2px 7px",
            borderRadius: "10px", color: cfg.color, background: cfg.bg,
          }}>
            {cfg.label}
          </span>
        );
      })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT RELATIONSHIPS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function EditRelationshipsModal({ token, employee, periodId, onClose, onSaved }) {
  const VALID = ["peer", "subordinate", "superior"];
  const [selected, setSelected] = useState(() => new Set(employee.relationships ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(rel) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(rel) ? next.delete(rel) : next.add(rel);
      return next;
    });
  }

  async function handleSave() {
    if (!periodId) {
      setError("No active evaluation period found. Activate a period first before assigning relationships.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const chosenRels = VALID.filter(r => selected.has(r));
      const result = await updateRelationships(token, employee.id, chosenRels, periodId);
      onSaved(`Relationships updated. ${result.assignments_created ?? 0} assignment(s) created.`, result.chosen_relationships ?? chosenRels);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h3 className="modal__title">Edit Relationships — {employee.full_name}</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "14px", lineHeight: 1.5 }}>
            Select which evaluation types this employee participates in.
            They will rate — and be rated by — all other employees sharing the same type
            in the active evaluation period.
          </p>
          {!periodId && (
            <p style={{ fontSize: "12px", color: "#e65100", background: "#fff3e0", padding: "8px 10px", borderRadius: "6px", marginBottom: "12px" }}>
              ⚠️ No active evaluation period detected. Activate a period first or assignments will not be created.
            </p>
          )}
          {(() => {
            const allSelected = VALID.every(r => selected.has(r));
            return (
              <label style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", marginBottom: "6px",
                border: allSelected ? "1.5px solid #1a1a2e" : "1.5px solid #dde",
                borderRadius: "8px",
                background: allSelected ? "#1a1a2e" : "#fafafa",
                cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) setSelected(new Set());
                    else setSelected(new Set(VALID));
                  }}
                  style={{ accentColor: "#fff", width: "15px", height: "15px" }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: allSelected ? "#fff" : "#1a1a2e" }}>
                    All
                  </div>
                  <div style={{ fontSize: "11px", color: allSelected ? "rgba(255,255,255,0.7)" : "#777", marginTop: "2px" }}>
                    Peer + Subordinate + Superior
                  </div>
                </div>
              </label>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {VALID.map(rel => {
              const cfg = REL_CONFIG[rel];
              const checked = selected.has(rel);
              return (
                <label key={rel} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "10px 12px",
                  border: checked ? `1.5px solid ${cfg.color}` : "1.5px solid #dde",
                  borderRadius: "8px",
                  background: checked ? cfg.bg : "#fafafa",
                  cursor: "pointer",
                }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(rel)}
                    style={{ marginTop: "2px", accentColor: cfg.color, width: "15px", height: "15px" }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "#1a1a2e" }}>{cfg.label}</div>
                    <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                      Rates and is rated by all other employees assigned as {cfg.label}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          {error && <p className="form-error" style={{ marginTop: "10px" }}>{error}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Relationships"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD / EDIT PERIOD MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PeriodModal({ token, companyId, existing, onClose, onSaved }) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    label: existing?.label ?? "",
    start_date: existing?.start_date ?? "",
    end_date: existing?.end_date ?? "",
    deadline_date: existing?.deadline_date ?? "",
    is_active: existing?.is_active ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit() {
    if (!form.label.trim() || !form.start_date || !form.end_date || !form.deadline_date) {
      setError("All fields are required.");
      return;
    }
    if (form.deadline_date > form.end_date) {
      setError("Deadline date cannot be after the end date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await updatePeriod(token, existing.id, form);
        onSaved("Evaluation period updated.");
      } else {
        await addPeriod(token, { ...form, company_id: companyId });
        onSaved("Evaluation period created.");
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h3 className="modal__title">{isEdit ? "Edit Period" : "Add Evaluation Period"}</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div className="form-field">
            <label className="form-field__label">Period Label *</label>
            <input className="form-field__input" placeholder="e.g. Q1 2025 Evaluation"
              value={form.label} onChange={e => set("label", e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-field__label">Start Date *</label>
              <input type="date" className="form-field__input"
                value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-field__label">End Date *</label>
              <input type="date" className="form-field__input"
                value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-field__label">Submission Deadline *</label>
            <input type="date" className="form-field__input"
              value={form.deadline_date} onChange={e => set("deadline_date", e.target.value)} />
            <span style={{ fontSize: "11px", color: "#888", marginTop: "4px", display: "block" }}>
              Survey submissions are disabled after this date.
            </span>
          </div>
          {isEdit && (
            <div className="form-field" style={{ marginTop: "4px" }}>
              <label style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px",
                border: form.is_active ? "1.5px solid #43a047" : "1.5px solid #dde",
                borderRadius: "8px",
                background: form.is_active ? "#E8F5E9" : "#fafafa",
                cursor: "pointer",
                fontSize: "13px",
              }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)}
                  style={{ accentColor: "#43a047", width: "15px", height: "15px" }} />
                <div>
                  <div style={{ fontWeight: 600, color: "#1a1a2e" }}>Active Period</div>
                  <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                    Only one period can be active at a time. Activating this will deactivate all others.
                  </div>
                </div>
              </label>
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Period"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD COMPANY MODAL  (with logo upload + optional first evaluation period)
// ─────────────────────────────────────────────────────────────────────────────
function AddCompanyModal({ token, onClose, onSaved }) {
  const logoInputRef = useRef();

  const [form, setForm] = useState({
    name: "", address: "", contact_name: "", contact_email: "",
  });

  const [includePeriod, setIncludePeriod] = useState(false);
  const [period, setPeriod] = useState({
    label: "", start_date: "", end_date: "", deadline_date: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setF(field, val) { setForm(f => ({ ...f, [field]: val })); }
  function setP(field, val) { setPeriod(f => ({ ...f, [field]: val })); }

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Company name is required."); return; }
    if (includePeriod) {
      if (!period.label.trim() || !period.start_date || !period.end_date || !period.deadline_date) {
        setError("All evaluation period fields are required when adding a period.");
        return;
      }
    }
    setSaving(true);
    setError("");

    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("address", form.address);
    fd.append("contact_name", form.contact_name);
    fd.append("contact_email", form.contact_email);
    if (logoFile) fd.append("logo", logoFile);

    if (includePeriod) {
      fd.append("period_label", period.label.trim());
      fd.append("period_start_date", period.start_date);
      fd.append("period_end_date", period.end_date);
      fd.append("period_deadline_date", period.deadline_date);
    }

    try {
      const result = await addCompany(token, fd);
      const periodMsg = result.period ? " Evaluation period created." : "";
      onSaved(`Company created successfully.${periodMsg}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "540px" }}>
        <div className="modal__header">
          <h3 className="modal__title">Add Company</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body" style={{ maxHeight: "72vh", overflowY: "auto" }}>

          {/* ── Company Logo ── */}
          <div className="form-field" style={{ marginBottom: "16px" }}>
            <label className="form-field__label">Company Logo <span style={{ fontWeight: 400, color: "#999" }}>(optional)</span></label>
            <div
              onClick={() => logoInputRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "12px 14px",
                border: "1.5px dashed #c0c0d0",
                borderRadius: "8px",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview"
                  style={{ width: "56px", height: "56px", objectFit: "contain", borderRadius: "6px", border: "1px solid #dde" }} />
              ) : (
                <div style={{
                  width: "56px", height: "56px", borderRadius: "6px",
                  background: "#e8eaf6", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "24px",
                }}>🏢</div>
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "#1a1a2e" }}>
                  {logoFile ? logoFile.name : "Click to upload logo"}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                  PNG, JPG, WEBP or SVG · Max 2 MB
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                style={{ display: "none" }}
                onChange={handleLogoChange}
              />
            </div>
          </div>

          {/* ── Company Details ── */}
          <div className="form-field">
            <label className="form-field__label">Company Name *</label>
            <input className="form-field__input" placeholder="e.g. Premier Value Provider Inc."
              value={form.name} onChange={e => setF("name", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Address</label>
            <input className="form-field__input" placeholder="Office address"
              value={form.address} onChange={e => setF("address", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Contact Person</label>
            <input className="form-field__input" placeholder="Full name"
              value={form.contact_name} onChange={e => setF("contact_name", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Contact Email</label>
            <input className="form-field__input" type="email" placeholder="contact@company.com"
              value={form.contact_email} onChange={e => setF("contact_email", e.target.value)} />
          </div>

          {/* ── Evaluation Period (collapsible) ── */}
          <div style={{
            marginTop: "16px",
            border: includePeriod ? "1.5px solid #1a1a2e" : "1.5px solid #dde",
            borderRadius: "8px",
            overflow: "hidden",
          }}>
            <label style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "12px 14px",
              background: includePeriod ? "#f0f4ff" : "#fafafa",
              cursor: "pointer",
            }}>
              <input type="checkbox" checked={includePeriod} onChange={e => setIncludePeriod(e.target.checked)}
                style={{ accentColor: "#1a1a2e", width: "15px", height: "15px" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "#1a1a2e" }}>Add Evaluation Period</div>
                <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                  Optional — you can add periods later from the company view.
                </div>
              </div>
            </label>

            {includePeriod && (
              <div style={{ padding: "14px", borderTop: "1px solid #e8eaf0" }}>
                <div className="form-field">
                  <label className="form-field__label">Period Label *</label>
                  <input className="form-field__input" placeholder="e.g. Q1 2025 Evaluation"
                    value={period.label} onChange={e => setP("label", e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-field__label">Start Date *</label>
                    <input type="date" className="form-field__input"
                      value={period.start_date} onChange={e => setP("start_date", e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">End Date *</label>
                    <input type="date" className="form-field__input"
                      value={period.end_date} onChange={e => setP("end_date", e.target.value)} />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-field__label">Submission Deadline *</label>
                  <input type="date" className="form-field__input"
                    value={period.deadline_date} onChange={e => setP("deadline_date", e.target.value)} />
                  <span style={{ fontSize: "11px", color: "#888", marginTop: "4px", display: "block" }}>
                    Period will be <b>inactive</b> by default — activate it from the company view when ready.
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && <p className="form-error" style={{ marginTop: "10px" }}>{error}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create Company"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT COMPANY MODAL
// ─────────────────────────────────────────────────────────────────────────────
function EditCompanyModal({ token, company, onClose, onSaved }) {
  const logoInputRef = useRef();

  const [form, setForm] = useState({
    name: company.name ?? "",
    address: company.address ?? "",
    contact_name: company.contact_name ?? "",
    contact_email: company.contact_email ?? "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(company.logo_url ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setF(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setSaving(true);
    setError("");

    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("address", form.address);
    fd.append("contact_name", form.contact_name);
    fd.append("contact_email", form.contact_email);
    if (logoFile) fd.append("logo", logoFile);

    try {
      const result = await updateCompany(token, company.id, fd);
      onSaved("Company updated successfully.", result.company);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "540px" }}>
        <div className="modal__header">
          <h3 className="modal__title">Edit Company</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body" style={{ maxHeight: "72vh", overflowY: "auto" }}>

          {/* ── Logo ── */}
          <div className="form-field" style={{ marginBottom: "16px" }}>
            <label className="form-field__label">
              Company Logo <span style={{ fontWeight: 400, color: "#999" }}>(optional)</span>
            </label>
            <div
              onClick={() => logoInputRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "12px 14px",
                border: "1.5px dashed #c0c0d0",
                borderRadius: "8px",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview"
                  style={{ width: "56px", height: "56px", objectFit: "contain", borderRadius: "6px", border: "1px solid #dde" }} />
              ) : (
                <div style={{
                  width: "56px", height: "56px", borderRadius: "6px",
                  background: "#e8eaf6", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "24px",
                }}>🏢</div>
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "#1a1a2e" }}>
                  {logoFile ? logoFile.name : logoPreview ? "Click to replace logo" : "Click to upload logo"}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                  PNG, JPG, WEBP or SVG · Max 2 MB
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                style={{ display: "none" }}
                onChange={handleLogoChange}
              />
            </div>
          </div>

          {/* ── Details ── */}
          <div className="form-field">
            <label className="form-field__label">Company Name *</label>
            <input className="form-field__input" placeholder="e.g. Premier Value Provider Inc."
              value={form.name} onChange={e => setF("name", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Address</label>
            <input className="form-field__input" placeholder="Office address"
              value={form.address} onChange={e => setF("address", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Contact Person</label>
            <input className="form-field__input" placeholder="Full name"
              value={form.contact_name} onChange={e => setF("contact_name", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Contact Email</label>
            <input className="form-field__input" type="email" placeholder="contact@company.com"
              value={form.contact_email} onChange={e => setF("contact_email", e.target.value)} />
          </div>

          {error && <p className="form-error" style={{ marginTop: "10px" }}>{error}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD EMPLOYEE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function AddEmployeeModal({ token, companyId, departments, onClose, onSaved }) {
  const [form, setForm] = useState({
    last_name: "", first_name: "", middle_name: "",
    email: "", role: "employee", department_id: "",
  });
  const [relationships, setRelationships] = useState({ peer: false, subordinate: false, superior: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setName(field, val) { setForm(f => ({ ...f, [field]: val.toUpperCase() })); }
  function setRaw(field, val) { setForm(f => ({ ...f, [field]: val })); }
  function toggleRel(type) { setRelationships(p => ({ ...p, [type]: !p[type] })); }

  const previewName = (() => {
    const l = form.last_name.trim();
    const f = form.first_name.trim();
    const m = form.middle_name.trim();
    if (!l && !f) return "";
    const mi = m ? ` ${m[0].toUpperCase()}.` : "";
    return `${l}, ${f}${mi}`;
  })();

  async function handleSubmit() {
    if (!form.last_name.trim() || !form.first_name.trim() || !form.email.trim()) {
      setError("Last name, first name, and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const chosenRels = Object.entries(relationships).filter(([, v]) => v).map(([k]) => k);
      const result = await addEmployee(token, { ...form, company_id: companyId, relationships: chosenRels });
      const assignMsg = result.assignments_created > 0
        ? ` ${result.assignments_created} assignment(s) created.` : "";
      onSaved(`Employee added and registration code sent.${assignMsg}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h3 className="modal__title">Add Employee</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-field__label">Last Name *</label>
              <input className="form-field__input" placeholder="e.g. DELA CRUZ"
                value={form.last_name} onChange={e => setName("last_name", e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-field__label">First Name *</label>
              <input className="form-field__input" placeholder="e.g. JUAN"
                value={form.first_name} onChange={e => setName("first_name", e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-field__label">Middle Name <span style={{ fontWeight: 400, color: "#999" }}>(optional)</span></label>
            <input className="form-field__input" placeholder="e.g. CASTILLO"
              value={form.middle_name} onChange={e => setName("middle_name", e.target.value)} />
          </div>
          {previewName && (
            <div className="form-field__preview">
              <span className="form-field__preview-label">Will be saved as:</span>
              <span className="form-field__preview-value">{previewName}</span>
            </div>
          )}
          <div className="form-field">
            <label className="form-field__label">Email *</label>
            <input className="form-field__input" type="email" placeholder="employee@company.com"
              value={form.email} onChange={e => setRaw("email", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Role</label>
            <select className="form-field__input" value={form.role} onChange={e => setRaw("role", e.target.value)}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-field__label">Department</label>
            <select className="form-field__input" value={form.department_id} onChange={e => setRaw("department_id", e.target.value)}>
              <option value="">— Select Department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: "4px" }}>
            <label className="form-field__label" style={{ marginBottom: "6px", display: "block" }}>
              Evaluation Types <span style={{ fontWeight: 400, color: "#999" }}>(optional)</span>
            </label>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px", lineHeight: 1.5 }}>
              Select which assessment types this employee participates in.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(REL_CONFIG).map(([type, cfg]) => (
                <label key={type} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "10px 12px",
                  border: relationships[type] ? `1.5px solid ${cfg.color}` : "1.5px solid #dde",
                  borderRadius: "8px",
                  background: relationships[type] ? cfg.bg : "#fafafa",
                  cursor: "pointer",
                }}>
                  <input type="checkbox" checked={relationships[type]} onChange={() => toggleRel(type)}
                    style={{ marginTop: "2px", accentColor: cfg.color, width: "15px", height: "15px" }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "#1a1a2e" }}>{cfg.label}</div>
                    <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                      Rates and is rated by all other employees assigned as {cfg.label}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="form-error" style={{ marginTop: "10px" }}>{error}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Add & Send Code"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPLOAD MODAL
// ─────────────────────────────────────────────────────────────────────────────
function BulkUploadModal({ token, onClose, onSaved }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) { setError("Please select an Excel file."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await bulkUpload(token, file);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h3 className="modal__title">Upload Complete</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <p className="upload-result">✅ <b>{result.added}</b> employee(s) added.</p>
          {result.assignments_created > 0 && (
            <p className="upload-result" style={{ color: "#1565c0", marginTop: "6px" }}>
              🔗 <b>{result.assignments_created}</b> rater-ratee assignment(s) created.
            </p>
          )}
          {result.no_active_period && (
            <p style={{ fontSize: "13px", color: "#e65100", background: "#fff3e0", padding: "8px 10px", borderRadius: "6px", marginTop: "8px" }}>
              ⚠️ No active evaluation period found — assignments were skipped.
            </p>
          )}
          {result.email_failures?.length > 0 && (
            <>
              <p className="upload-skipped-label" style={{ color: "#e65100" }}>
                ⚠️ <b>{result.email_failures.length}</b> email(s) failed to send:
              </p>
              <ul className="upload-skipped-list">
                {result.email_failures.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          )}
          {result.skipped?.length > 0 && (
            <>
              <p className="upload-skipped-label">⚠️ <b>{result.skipped.length}</b> row(s) skipped:</p>
              <ul className="upload-skipped-list">
                {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </>
          )}
        </div>
        <div className="modal__footer">
          <button className="btn btn--primary" onClick={() => onSaved()}>Done</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h3 className="modal__title">Bulk Upload Employees</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <p className="upload-instructions">
            Upload an <b>.xlsx</b> file with columns:{" "}
            <code>last_name</code>, <code>first_name</code>, <code>middle_name</code>,{" "}
            <code>email</code>, <code>role</code>, <code>department</code>, <code>assignment</code>.
          </p>
          <div className="upload-dropzone" onClick={() => fileRef.current?.click()}>
            {file
              ? <p className="upload-dropzone__filename">📄 {file.name}</p>
              : <p className="upload-dropzone__placeholder">Click to select an Excel file (.xlsx)</p>
            }
            <input ref={fileRef} type="file" accept=".xlsx,.xls"
              className="upload-dropzone__input"
              onChange={e => { setFile(e.target.files[0]); setError(""); }} />
          </div>
          <a href="/templates/employee_upload_template.xlsx" download className="upload-template-link">
            ⬇ Download Excel Template
          </a>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn--primary" onClick={handleUpload} disabled={loading || !file}>
            {loading ? "Uploading…" : "Upload & Send Codes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERIODS PANEL  (inline inside company view — no separate page needed)
// ─────────────────────────────────────────────────────────────────────────────
function PeriodsPanel({ token, company, showToast, onPeriodChange }) {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPeriod, setEditPeriod] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function fetchPeriods() {
    setLoading(true);
    try {
      const data = await getPeriods(token, company.id);
      setPeriods(data.periods ?? []);
    } catch (err) {
      showToast("Failed to load periods: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPeriods(); }, [company.id]);

  async function handleDelete(period) {
    if (!window.confirm(`Delete period "${period.label}"? This cannot be undone.`)) return;
    setDeleting(period.id);
    try {
      await deletePeriod(token, period.id);
      showToast("Period deleted.");
      fetchPeriods();
      onPeriodChange?.();
    } catch (err) {
      showToast(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1a1a2e" }}>Evaluation Periods</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#888" }}>
            Only one period can be active at a time. Activate a period to enable survey submissions.
          </p>
        </div>
        <button className="btn btn--primary" style={{ fontSize: "13px", padding: "7px 16px" }}
          onClick={() => setShowAdd(true)}>
          + Add Period
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "#999" }}>Loading periods…</p>
      ) : periods.length === 0 ? (
        <div style={{
          padding: "16px", borderRadius: "8px", border: "1.5px dashed #c0c0d0",
          background: "#fafafa", fontSize: "13px", color: "#888", textAlign: "center",
        }}>
          No evaluation periods yet. Click <b>+ Add Period</b> to create one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {periods.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              border: p.is_active ? "1.5px solid #43a047" : "1.5px solid #e8eaf0",
              borderRadius: "8px",
              background: p.is_active ? "#F1F8E9" : "#fff",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "#1a1a2e" }}>{p.label}</span>
                  {p.is_active && (
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "2px 8px",
                      borderRadius: "10px", background: "#C8E6C9", color: "#2E7D32",
                    }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "3px" }}>
                  {p.start_date} → {p.end_date} &nbsp;·&nbsp; Deadline: {p.deadline_date}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {!p.is_active && (
                  <button
                    className="action-btn"
                    style={{ color: "#2E7D32", borderColor: "#A5D6A7", fontWeight: 700 }}
                    disabled={deleting === p.id}
                    title="Set this as the active period"
                    onClick={async () => {
                      try {
                        await updatePeriod(token, p.id, { is_active: true });
                        showToast(`"${p.label}" is now the active period.`);
                        fetchPeriods();
                        onPeriodChange?.();
                      } catch (err) {
                        showToast("Failed to activate: " + err.message);
                      }
                    }}
                  >Activate</button>
                )}
                <button className="action-btn" onClick={() => setEditPeriod(p)}>Edit</button>
                <button
                  className="action-btn action-btn--danger"
                  disabled={p.is_active || deleting === p.id}
                  title={p.is_active ? "Cannot delete an active period" : "Delete period"}
                  onClick={() => handleDelete(p)}
                >
                  {deleting === p.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <PeriodModal
          token={token}
          companyId={company.id}
          existing={null}
          onClose={() => setShowAdd(false)}
          onSaved={(msg) => { setShowAdd(false); showToast(msg); fetchPeriods(); onPeriodChange?.(); }}
        />
      )}
      {editPeriod && (
        <PeriodModal
          token={token}
          companyId={company.id}
          existing={editPeriod}
          onClose={() => setEditPeriod(null)}
          onSaved={(msg) => { setEditPeriod(null); showToast(msg); fetchPeriods(); onPeriodChange?.(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 1 — COMPANY LIST
// ─────────────────────────────────────────────────────────────────────────────
function CompanyListView({ token, onSelectCompany, showToast }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  async function fetchCompanies() {
    setLoading(true);
    try {
      const data = await getCompanies(token);
      setCompanies(data.companies ?? []);
    } catch (err) {
      showToast("Failed to load companies: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCompanies(); }, []);

  const filtered = companies.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Employee Management</h1>
          <p className="page-header__subtitle">Select a company to manage its employees, or add a new company.</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setShowAdd(true)}>+ Add Company</button>
        </div>
      </div>

      <div className="filter-row">
        <input className="filter-row__search" placeholder="Search companies…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <span className="filter-row__count">
          {filtered.length} compan{filtered.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      {loading ? (
        <div className="table-empty">Loading companies…</div>
      ) : filtered.length === 0 ? (
        <div className="table-empty">No companies found. Click <b>+ Add Company</b> to create one.</div>
      ) : (
        <div className="company-grid">
          {filtered.map(company => (
            <div key={company.id} className="company-card" onClick={() => onSelectCompany(company)}>
              <div className="company-card__icon">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name}
                    style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "6px" }} />
                ) : "🏢"}
              </div>
              <div className="company-card__info">
                <h3 className="company-card__name">{company.name}</h3>
                {company.contact_name && <p className="company-card__meta">Contact: {company.contact_name}</p>}
                {company.contact_email && <p className="company-card__meta">{company.contact_email}</p>}
                <span className={`status-badge status-badge--${company.is_active ? "active" : "inactive"}`}>
                  {company.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="company-card__arrow">›</div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddCompanyModal
          token={token}
          onClose={() => setShowAdd(false)}
          onSaved={(msg) => { setShowAdd(false); showToast(msg); fetchCompanies(); }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 2 — EMPLOYEE LIST (for a selected company)
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeListView({ token, company, onBack, showToast }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activePeriodId, setActivePeriodId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [currentCompany, setCurrentCompany] = useState(company);
  const [resending, setResending] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [editRelEmp, setEditRelEmp] = useState(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [empData, deptData] = await Promise.all([
        getEmployees(token, currentCompany.id),
        getDepartments(token, currentCompany.id),
      ]);
      setEmployees(empData.employees ?? []);
      setActivePeriodId(empData.active_period_id ?? null);
      setDepartments(deptData.departments ?? []);
    } catch (err) {
      showToast("Failed to load employees: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [currentCompany.id]);

  async function handleResend(emp) {
    setResending(emp.id);
    try {
      await resendCode(token, emp.id);
      showToast(`Registration code resent to ${emp.email}.`);
      fetchData();
    } catch (err) {
      showToast("Failed to resend: " + err.message);
    } finally {
      setResending(null);
    }
  }

  async function handleToggleActive(emp) {
    setToggling(emp.id);
    try {
      await toggleActive(token, emp.id, !emp.is_active);
      showToast(`${emp.full_name} ${!emp.is_active ? "activated" : "deactivated"}.`);
      fetchData();
    } catch (err) {
      showToast("Failed to update: " + err.message);
    } finally {
      setToggling(null);
    }
  }

  const filtered = employees.filter(emp => {
    const matchSearch =
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "all" ? true :
        filterStatus === "active" ? emp.is_active :
          filterStatus === "inactive" ? !emp.is_active :
            emp.code_status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <>
      {/* Breadcrumb + page header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <button className="breadcrumb__link" onClick={onBack}>Employee Management</button>
            <span className="breadcrumb__sep">›</span>
            <span className="breadcrumb__current">{currentCompany.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {currentCompany.logo_url ? (
              <img
                src={currentCompany.logo_url}
                alt={currentCompany.name}
                style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "6px", border: "1px solid #e0e0e0" }}
              />
            ) : (
              <div style={{
                width: "36px", height: "36px", borderRadius: "6px",
                background: "#e8eaf6", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "20px", flexShrink: 0,
              }}>🏢</div>
            )}
            <h1 className="page-header__title" style={{ margin: 0 }}>{currentCompany.name}</h1>
            <button className="btn btn--secondary" style={{ fontSize: "12px", padding: "5px 12px" }}
              onClick={() => setShowEditCompany(true)}>
              Edit Company
            </button>
          </div>
          <p className="page-header__subtitle">
            Managing employees · {employees.length} total
            {!activePeriodId && (
              <span style={{ color: "#e65100", marginLeft: "8px", fontSize: "12px" }}>
                ⚠️ No active period — relationship assignments disabled
              </span>
            )}
          </p>
        </div>
        <div className="page-header__actions" />
      </div>

      {/* ── Periods panel ── */}
      <PeriodsPanel token={token} company={currentCompany} showToast={showToast} onPeriodChange={fetchData} />

      {/* ── Employee table ── */}
      <div style={{ borderTop: "1px solid #e8eaf0", paddingTop: "20px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1a1a2e" }}>Employees</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn--secondary" style={{ fontSize: "13px", padding: "7px 16px" }} onClick={() => setShowBulk(true)}>⬆ Bulk Upload</button>
          <button className="btn btn--primary" style={{ fontSize: "13px", padding: "7px 16px" }} onClick={() => setShowAdd(true)}>+ Add Employee</button>
        </div>
      </div>

      <div className="filter-row">
        <input className="filter-row__search" placeholder="Search by name or email…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-row__select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Employees</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Code: Pending</option>
          <option value="used">Code: Used</option>
          <option value="expired">Code: Expired</option>
        </select>
        <span className="filter-row__count">
          {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="table-empty">Loading employees…</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">No employees found.</div>
        ) : (
          <table className="emp-table">
            <thead>
              <tr>
                {["Full Name", "Email", "Department", "Role", "Relationships", "Code Status", "Account", "Actions"].map(h => (
                  <th key={h} className="emp-table__th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr key={emp.id} className={`emp-table__row ${i % 2 === 0 ? "" : "emp-table__row--alt"}`}>
                  <td className="emp-table__td"><span className="emp-name">{emp.full_name}</span></td>
                  <td className="emp-table__td">{emp.email}</td>
                  <td className="emp-table__td">{emp.department_name ?? "—"}</td>
                  <td className="emp-table__td">
                    <span className={`role-badge role-badge--${emp.role}`}>
                      {emp.role === "admin" ? "Admin" : "Employee"}
                    </span>
                  </td>
                  <td className="emp-table__td" style={{ minWidth: "160px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <RelBadges relationships={emp.relationships} />
                      <button
                        className="action-btn"
                        style={{ fontSize: "11px", padding: "3px 8px", marginRight: 0 }}
                        onClick={() => setEditRelEmp(emp)}
                        title="Edit evaluation relationships"
                      >Edit</button>
                    </div>
                  </td>
                  <td className="emp-table__td"><CodeBadge status={emp.code_status ?? "none"} /></td>
                  <td className="emp-table__td">
                    <span className={`status-badge status-badge--${emp.is_active ? "active" : "inactive"}`}>
                      {emp.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="emp-table__td emp-table__td--actions">
                    {(emp.code_status === "pending" || emp.code_status === "expired") && (
                      <button className="action-btn" disabled={resending === emp.id}
                        onClick={() => handleResend(emp)}>
                        {resending === emp.id ? "Sending…" : "Resend Code"}
                      </button>
                    )}
                    <button
                      className={`action-btn ${emp.is_active ? "action-btn--danger" : "action-btn--activate"}`}
                      disabled={toggling === emp.id}
                      onClick={() => handleToggleActive(emp)}
                    >
                      {toggling === emp.id ? "…" : emp.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddEmployeeModal
          token={token} companyId={currentCompany.id} departments={departments}
          onClose={() => setShowAdd(false)}
          onSaved={(msg) => { setShowAdd(false); showToast(msg); fetchData(); }}
        />
      )}
      {showBulk && (
        <BulkUploadModal
          token={token}
          onClose={() => setShowBulk(false)}
          onSaved={() => { setShowBulk(false); fetchData(); }}
        />
      )}
      {editRelEmp && (
        <EditRelationshipsModal
          token={token} employee={editRelEmp} periodId={activePeriodId}
          onClose={() => setEditRelEmp(null)}
          onSaved={(msg, chosenRels) => {
            setEmployees(prev => prev.map(e =>
              e.id === editRelEmp.id ? { ...e, relationships: chosenRels ?? [] } : e
            ));
            setEditRelEmp(null);
            showToast(msg);
          }}
        />
      )}
      {showEditCompany && (
        <EditCompanyModal
          token={token}
          company={currentCompany}
          onClose={() => setShowEditCompany(false)}
          onSaved={(msg, updatedCompany) => {
            setShowEditCompany(false);
            showToast(msg);
            if (updatedCompany) setCurrentCompany(updatedCompany);
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminEmployees() {
  const navigate = useNavigate();
  const rater = useSurveyStore(s => s.rater);
  const token = useSurveyStore(s => s.token);
  const logout = useSurveyStore(s => s.logout);

  const [selectedCompany, setSelectedCompany] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!rater || !token) { navigate("/login", { replace: true }); return; }
    if (rater.role !== "admin") { navigate("/select-role", { replace: true }); return; }
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 4000); }
  function handleLogout() { logout(); navigate("/login", { replace: true }); }

  const displayName = rater?.full_name ?? "Admin";

  return (
    <>
      <header className="admin-header">
        <nav className="admin-navbar">
          <a href="#" className="admin-navbar__logo">
            <img src={pvpLogo} alt="PVP logo" className="admin-navbar__logo-img" />
          </a>
          <ul className="admin-navbar__links">
            <li><a href="/admin" className="admin-navbar__link">Dashboard</a></li>
            <li><a href="/admin/employees" className="admin-navbar__link admin-navbar__link--active">Employees</a></li>
            <li><a href="/admin/assignments" className="admin-navbar__link">Assignments</a></li>
            <li><a href="/admin/periods" className="admin-navbar__link">Periods</a></li>
            <li><a href="/admin/questions" className="admin-navbar__link">Questions</a></li>
            <li>
              <a href="#" className="admin-navbar__link"
                onClick={e => { e.preventDefault(); handleLogout(); }}>
                Log out ({displayName})
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <main className="admin-main">
        {selectedCompany === null ? (
          <CompanyListView
            token={token}
            onSelectCompany={setSelectedCompany}
            showToast={showToast}
          />
        ) : (
          <EmployeeListView
            token={token}
            company={selectedCompany}
            onBack={() => setSelectedCompany(null)}
            showToast={showToast}
          />
        )}
      </main>

      <footer className="admin-footer">
        <p>©2024 Premier Value Provider, Inc. All Rights Reserved.</p>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}