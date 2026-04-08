// client/src/pages/company/SurveyTY.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Converts: survey_ty.html  (1 file → 1 component)
// CSS     : survey_ty.css   → SurveyTY.css  (zero style changes)
// Route   : /survey-ty
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect }   from "react";
import { useNavigate } from "react-router-dom";
import useSurveyStore  from "../../store/surveyStore";
import "../../assets/company/SurveyTY.css";

export default function SurveyTY() {
  const navigate  = useNavigate();
  const rater     = useSurveyStore((s) => s.rater);
  const token     = useSurveyStore((s) => s.token);
  const logout    = useSurveyStore((s) => s.logout);
  const resetSurvey = useSurveyStore((s) => s.resetSurvey);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!rater || !token) {
      navigate("/login", { replace: true });
      return;
    }
    // Clear in-progress survey data (ratee, answers) but keep auth/rater info
    // so the user can retake another survey without re-logging in
    resetSurvey();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleRetake() {
    // resetSurvey already called on mount — just go back to role selection
    navigate("/select-role");
  }

  const displayName = rater?.full_name ?? "User";

  return (
    <body className="body-for-sticky">

      {/* ── HEADER ── */}
      <header>
        <nav className="navbar">
          <a href="#" className="logo">
            <img src="images/pvp.png" alt="logo" />
          </a>
          <ul className="links">
            <li><a href="#">Welcome {displayName}</a></li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
                Log out
              </a>
            </li>
          </ul>
        </nav>
      </header>

      {/* ── CONTENT ── */}
      <div className="container-fliud">
        <div className="container">
          <div className="category-card">
            <div className="category-ty">
              <h3>Thank You!</h3>
              <h5>
                Thank you for taking your time rating. We assure that your answer will
                classified and will be used to improved certain individuals.
              </h5>
            </div>
          </div>
        </div>

        <div className="button">
          <button className="retake" onClick={handleRetake}>
            &#8634; Retake Survey again
          </button>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-col">
          <h4>Premier Value Provider Inc.</h4>
          <p>
            Boost productivity and well-being in your{" "}
            <br /> workplace with Premier Value Provider! Join us{" "}
            <br />in building a thriving workplace culture.
          </p>
          <div className="icon-links">
            <a href="https://www.linkedin.com/company/pvpi/mycompany/?viewAsMember=true" className="fa fa-linkedin"></a>
            <a href="https://www.facebook.com/pvpiph"    className="fa fa-facebook"></a>
            <a href="https://www.instagram.com/pvpi.ph/" className="fa fa-instagram"></a>
            <a href="https://www.youtube.com/@pvptv636"  className="fa fa-youtube"></a>
            <p>©2024 Premier Value Provider, Inc. <br /> All Rights reserved.</p>
          </div>
        </div>
      </footer>

    </body>
  );
}