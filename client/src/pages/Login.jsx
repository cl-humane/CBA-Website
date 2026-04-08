// client/src/pages/Login.jsx
// Fully connected to POST /api/v1/auth/login via Express → Supabase.
// On success: stores JWT + user in surveyStore, redirects by role.

import { useState }         from "react";
import { useNavigate }      from "react-router-dom";
import { login }            from "../api/auth";
import useSurveyStore       from "../store/surveyStore";
import "../assets/Login.css";

// Images in /public are served at root — use URL strings, not JS imports
const pvpLogo   = "/pvp.png";
const googleIcon = "/google.png";

export default function Login() {
  const navigate    = useNavigate();
  const setRater    = useSurveyStore((s) => s.setRater);

  const [showPassword, setShowPassword] = useState(false);

  // ── Login form state ──────────────────────────────────────────────────────
  const [loginEmail,    setLoginEmail]    = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError,    setLoginError]    = useState("");
  const [loginLoading,  setLoginLoading]  = useState(false);

  // ── LOGIN SUBMIT ──────────────────────────────────────────────────────────
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      // Calls POST /api/v1/auth/login  →  returns { token, user }
      const { token, user } = await login({
        email:    loginEmail,
        password: loginPassword,
      });

      // Persist JWT + user info in Zustand (backed by sessionStorage)
      setRater(user, token);

      // Redirect based on role (matches users.role ENUM: 'admin' | 'employee')
      if (user.role === "admin") {
        navigate("/admin/employees");
      } else {
        navigate("/select-role");
      }
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
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
            <li><a href="#">Take a Survey</a></li>
          </ul>
        </nav>
      </header>

      {/* FORMS */}
      <section className="container forms">

        {/* ── LOGIN FORM ── */}
        <div className="form login">
          <div className="form-content">
            <h1>Login</h1>

            <form onSubmit={handleLoginSubmit}>
              <div className="field input-field">
                <input
                  type="email"
                  placeholder="Email"
                  className="input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loginLoading}
                />
              </div>

              <div className="field input-field">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loginLoading}
                />
                <i
                  className={`bx ${showPassword ? "bxs-show" : "bxs-hide"} eye-icon`}
                  onClick={() => setShowPassword(!showPassword)}
                />
              </div>

              {loginError && (
                <p style={{ color: "red", fontSize: "13px", marginTop: "8px", textAlign: "center" }}>
                  {loginError}
                </p>
              )}

              <div className="form-link">
                <a href="#" className="forgot-pass">Forgot password?</a>
              </div>

              <div className="field button-field">
                <button type="submit" disabled={loginLoading}>
                  {loginLoading ? "Logging in…" : "Login"}
                </button>
              </div>
            </form>

            <div className="form-link">
              <span>
                Doesn't have an account?{" "}
                <a
                  href="#"
                  className="link signup-link"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/register");
                  }}
                >
                  Sign Up
                </a>
              </span>
            </div>
          </div>

          <div className="line" />

          <div className="media-options">
            <a href="#" className="field google">
              <img src={googleIcon} alt="Google" className="google-img" />
              <span>Sign in with Google</span>
            </a>
          </div>
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
            <p style={{ fontSize: "13px", wordSpacing: "2px" }}>
              ©2024 Premier Value Provider, Inc. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}