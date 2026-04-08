// client/src/pages/company/SurveyCatPeerComment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Consolidates: surveycat8_9peer.html
// CSS rename  : peersurveycat8_9.css  →  SurveyCatPeerComment.css
// Route       : /survey-cat-peer-comment
//
// Backend integration:
//   • On submit calls POST /api/v1/survey/submit with all Zustand answers
//     + the two freeform comments (strengths & areas of improvement).
//   • On success: clears survey state and navigates to /survey-ty.
//   • Handles 409 duplicate and other API errors gracefully.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import useSurveyStore          from "../../store/surveyStore";
import { submitSurvey }        from "../../api/survey";
import "../../assets/company/SurveyCatPeerComment.css";

export default function SurveyCatPeerComment() {
  const navigate = useNavigate();

  const rater          = useSurveyStore((s) => s.rater);
  const token          = useSurveyStore((s) => s.token);
  const selectedRatee  = useSurveyStore((s) => s.selectedRatee);
  const selectedPeriod = useSurveyStore((s) => s.selectedPeriod);
  const storeAnswers   = useSurveyStore((s) => s.answers);
  const resetSurvey    = useSurveyStore((s) => s.resetSurvey);
  const logout         = useSurveyStore((s) => s.logout);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rater || !token) navigate("/login",           { replace: true });
    if (!selectedRatee)   navigate("/rate-names/peer", { replace: true });
  }, [rater, token, selectedRatee, navigate]);

  // ── State — ids / names match original HTML exactly ───────────────────────
  const [prc8freeform, setPrc8freeform] = useState("");   // id="prc8freeform" name="peercat8"
  const [prc9freeform, setPrc9freeform] = useState("");   // id="prc9freeform" name="peercat9"
  const [formError,    setFormError]    = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function submitSurveyHandler() {
    if (!prc8freeform.trim() || !prc9freeform.trim()) {
      setFormError("Please fill in both Strengths and Areas of Improvements.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);

    // Build answers array from Zustand store
    const answersArray = Object.entries(storeAnswers).map(([questionId, val]) => ({
      question_id: questionId,
      score:       val.score ?? null,
      is_na:       val.is_na ?? false,
    }));

    const today = new Date().toISOString().split("T")[0];
    const payload = {
      ratee_id:       selectedRatee.id,
      relationship:   "peer",
      period_id:      selectedPeriod?.id ?? null,
      date_evaluated: today,
      answers:        answersArray,
      comments: {
        strengths:            prc8freeform.trim(),
        areas_of_improvement: prc9freeform.trim(),
      },
    };

    try {
      await submitSurvey(token, payload);
      resetSurvey();
      navigate("/survey-ty", { replace: true });
    } catch (err) {
      if (err.status === 409) {
        setFormError("You have already submitted an evaluation for this person.");
      } else {
        setFormError(err.message || "Submission failed. Please try again.");
      }
      setIsSubmitting(false);
    }
  }

  function handleLogout() { logout(); navigate("/login", { replace: true }); }

  const displayName = rater?.full_name         ?? "User";
  const rateeName   = selectedRatee?.full_name ?? "Lname, Fname MI";

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
            <li><a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Log out</a></li>
          </ul>
        </nav>
      </header>

      {/* ── CONTENTS ── */}
      <div className="container-fliud">

        {/* Person card */}
        <div className="container">
          <div className="row">
            <div className="col-md">
              <div className="card-content">
                <img src="images/icon3.png" alt="peer" />
                <a>
                  <h5>You are rating Peer,</h5>
                  <h6>{rateeName}</h6>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Part instruction */}
        <div className="part-card">
          <h5>PART 3. Please write your qualitative responses based on the items below:</h5>
        </div>

        <div className="container-card">
          <div className="container-card-inside">

            {/* Strengths — id="prc8freeform" name="peercat8" */}
            <div className="c8_card">
              <label htmlFor="prc8freeform">Strengths</label>
              <textarea
                id="prc8freeform"
                name="peercat8"
                placeholder="Enter text here..."
                required
                value={prc8freeform}
                onChange={(e) => setPrc8freeform(e.target.value)}
              />
            </div>

            {/* Areas of Improvements — id="prc9freeform" name="peercat9" */}
            <div className="c9_card">
              <label htmlFor="prc9freeform">Areas of Improvements</label>
              <textarea
                id="prc9freeform"
                name="peercat9"
                placeholder="Enter text here..."
                required
                value={prc9freeform}
                onChange={(e) => setPrc9freeform(e.target.value)}
              />
            </div>

            {formError && (
              <p style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>{formError}</p>
            )}

            <div className="c8c9reminder">
              <a><b>Reminder:</b> Click <b style={{ color: "red" }}>DONE</b> once you have completed the evaluation.</a>
            </div>

            <div className="buttons">
              <button className="prev" onClick={() => navigate("/survey-cat-peer/7")} disabled={isSubmitting}>&laquo; Prev</button>
              <button className="done" onClick={submitSurveyHandler} disabled={isSubmitting}>
                {isSubmitting ? "Submitting…" : <>Done &#10004;</>}
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-col">
          <h4>Premier Value Provider Inc.</h4>
          <p>Boost productivity and well-being in your <br /> workplace with Premier Value Provider! Join us <br />in building a thriving workplace culture.</p>
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