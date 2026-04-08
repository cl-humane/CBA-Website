// client/src/pages/Register.jsx
// Route: /register
//
// 3-step registration flow:
//   Step 1 — Enter work email + code (sent by admin)
//   Step 2 — Code validated: show welcome info, set password
//   Step 3 — Done: auto-login and redirect
//
// Matches Login.jsx visual style (same CSS file).

import { useState }    from "react";
import { useNavigate } from "react-router-dom";
import { verifyCode, register } from "../api/auth";
import useSurveyStore  from "../store/surveyStore";
import "../assets/Register.css";

const pvpLogo = "/pvp.png";

// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)                   score++;
  if (/[A-Z]/.test(password))                 score++;
  if (/[0-9]/.test(password))                 score++;
  if (/[^A-Za-z0-9]/.test(password))          score++;

  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "#e53935", "#fb8c00", "#43a047", "#1a3c6e"];
  return (
    <div className="pw-strength">
      <div className="pw-strength__bars">
        {[1,2,3,4].map(i => (
          <div key={i} className="pw-strength__bar"
            style={{ background: i <= score ? colors[score] : "#e0e0e0" }} />
        ))}
      </div>
      <span className="pw-strength__label" style={{ color: colors[score] }}>
        {labels[score]}
      </span>
    </div>
  );
}

export default function Register() {
  const navigate  = useNavigate();
  const setRater  = useSurveyStore(s => s.setRater);

  // Step 1 state
  const [email,        setEmail]        = useState("");
  const [code,         setCode]         = useState("");
  const [step1Error,   setStep1Error]   = useState("");
  const [step1Loading, setStep1Loading] = useState(false);

  // Verified user info (from step 1 response)
  const [verifiedInfo, setVerifiedInfo] = useState(null); // { full_name, role, company_name }

  // Step 2 state
  const [password,     setPassword]     = useState("");
  const [confirmPw,    setConfirmPw]    = useState("");
  const [showPw,       setShowPw]       = useState(false);
  const [step2Error,   setStep2Error]   = useState("");
  const [step2Loading, setStep2Loading] = useState(false);

  const [step, setStep] = useState(1); // 1 | 2 | 3

  // ── Step 1: verify email + code ─────────────────────────────────────────────
  async function handleVerify(e) {
    e.preventDefault();
    setStep1Error("");
    if (!email.trim() || !code.trim()) {
      setStep1Error("Please enter both your work email and registration code.");
      return;
    }
    setStep1Loading(true);
    try {
      const data = await verifyCode({ email: email.trim(), code: code.trim() });
      setVerifiedInfo(data);   // { valid, full_name, role, company_name }
      setStep(2);
    } catch (err) {
      setStep1Error(err.message);
    } finally {
      setStep1Loading(false);
    }
  }

  // ── Step 2: set password and register ───────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    setStep2Error("");
    if (password.length < 8) {
      setStep2Error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      setStep2Error("Passwords do not match.");
      return;
    }
    setStep2Loading(true);
    try {
      const data = await register({ email: email.trim(), code: code.trim(), password });
      if (data.auto_login && data.token && data.user) {
        setRater(data.user, data.token);
        setStep(3);
        setTimeout(() => {
          navigate(data.user.role === "admin" ? "/admin/employees" : "/select-role",
            { replace: true });
        }, 2000);
      } else {
        // Fallback: redirect to login
        setStep(3);
        setTimeout(() => navigate("/login", { replace: true }), 2500);
      }
    } catch (err) {
      setStep2Error(err.message);
    } finally {
      setStep2Loading(false);
    }
  }

  return (
    <>
      {/* HEADER */}
      <header>
        <nav className="navbar">
          <a href="#" className="logo">
            <img src={pvpLogo} alt="PVP logo" />
          </a>
          <ul className="links">
            <li><a href="#">Competency Based Assessment</a></li>
            <li><a href="/login">Login</a></li>
          </ul>
        </nav>
      </header>

      {/* MAIN */}
      <section className="register-section">
        <div className="register-card">

          {/* ── Step indicator ── */}
          <div className="reg-steps">
            {["Verify Code", "Set Password", "Complete"].map((label, i) => (
              <div key={i} className={`reg-step ${step === i + 1 ? "reg-step--active" : ""} ${step > i + 1 ? "reg-step--done" : ""}`}>
                <div className="reg-step__dot">
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span className="reg-step__label">{label}</span>
              </div>
            ))}
            <div className="reg-steps__line" />
          </div>

          {/* ── STEP 1: Verify Code ── */}
          {step === 1 && (
            <div className="reg-body">
              <h2 className="reg-title">Welcome to CBA</h2>
              <p className="reg-subtitle">
                Enter your work email and the registration code sent to you by your administrator.
              </p>

              <form onSubmit={handleVerify} className="reg-form">
                <div className="field input-field">
                  <input
                    type="email"
                    className="input"
                    placeholder="Work email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={step1Loading}
                    autoFocus
                  />
                </div>

                <div className="field input-field">
                  <input
                    type="text"
                    className="input code-input"
                    placeholder="Registration code (e.g. A3F2B1C9)"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    required
                    disabled={step1Loading}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>

                {step1Error && (
                  <p className="reg-error">{step1Error}</p>
                )}

                <div className="field button-field">
                  <button type="submit" disabled={step1Loading}>
                    {step1Loading ? "Verifying…" : "Verify Code →"}
                  </button>
                </div>
              </form>

              <p className="reg-footer-link">
                Already registered? <a href="/login">Log in</a>
              </p>
            </div>
          )}

          {/* ── STEP 2: Set Password ── */}
          {step === 2 && verifiedInfo && (
            <div className="reg-body">
              <div className="reg-welcome-card">
                <div className="reg-welcome-avatar">
                  {verifiedInfo.full_name?.[0] ?? "?"}
                </div>
                <div>
                  <p className="reg-welcome-name">{verifiedInfo.full_name}</p>
                  <p className="reg-welcome-meta">
                    {verifiedInfo.role === "admin" ? "Administrator" : "Employee"} · {verifiedInfo.company_name}
                  </p>
                </div>
              </div>

              <h2 className="reg-title">Set Your Password</h2>
              <p className="reg-subtitle">Choose a strong password for your account.</p>

              <form onSubmit={handleRegister} className="reg-form">
                <div className="field input-field">
                  <input
                    type={showPw ? "text" : "password"}
                    className="password"
                    placeholder="New password (min. 8 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={step2Loading}
                    autoFocus
                  />
                  <i
                    className={`bx ${showPw ? "bxs-show" : "bxs-hide"} eye-icon`}
                    onClick={() => setShowPw(v => !v)}
                  />
                </div>

                <PasswordStrength password={password} />

                <div className="field input-field">
                  <input
                    type={showPw ? "text" : "password"}
                    className="password"
                    placeholder="Confirm password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    required
                    disabled={step2Loading}
                  />
                </div>

                {step2Error && (
                  <p className="reg-error">{step2Error}</p>
                )}

                <div className="field button-field">
                  <button type="submit" disabled={step2Loading}>
                    {step2Loading ? "Creating account…" : "Complete Registration →"}
                  </button>
                </div>
              </form>

              <button className="reg-back-link" onClick={() => { setStep(1); setStep2Error(""); }}>
                ← Back
              </button>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div className="reg-body reg-body--center">
              <div className="reg-success-icon">✓</div>
              <h2 className="reg-title">Registration Complete!</h2>
              <p className="reg-subtitle">
                Your account is ready. Redirecting you now…
              </p>
              <div className="reg-spinner" />
            </div>
          )}

        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-col">
          <h4>Premier Value Provider Inc.</h4>
          <p>
            Boost productivity and well-being in your workplace with Premier
            Value Provider! Join us in building a thriving workplace culture.
          </p>
          <div className="icon-links">
            <a href="https://www.linkedin.com/company/pvpi/mycompany/?viewAsMember=true" className="fa fa-linkedin" />
            <a href="https://www.facebook.com/pvpiph"    className="fa fa-facebook"  />
            <a href="https://www.instagram.com/pvpi.ph/" className="fa fa-instagram" />
            <a href="https://www.youtube.com/@pvptv636"  className="fa fa-youtube"   />
            <p style={{ fontSize: "13px" }}>©2024 Premier Value Provider, Inc. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}