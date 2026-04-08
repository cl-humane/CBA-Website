// client/src/pages/company/SurveyCatSuperiorComment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Consolidates: surveycat7_8super.html
// CSS rename  : supersurveycat7_8.css  →  SurveyCatSuperiorComment.css  (content unchanged)
// Route       : /survey-cat-superior-comment
//
// Backend integration:
//   • On submit calls POST /api/v1/survey/submit with all Zustand answers
//     + the two freeform comments (Strengths & Areas of Improvements).
//   • On success: clears survey state and navigates to /survey-ty.
//   • Handles 409 duplicate and other API errors gracefully.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import useSurveyStore          from "../../store/surveyStore";
import { submitSurvey }        from "../../api/survey";
import "../../assets/company/SurveyCatSuperiorComment.css";   // ← same content as supersurveycat7_8.css

export default function SurveyCatSuperiorComment() {
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
    if (!rater || !token) navigate("/login",               { replace: true });
    if (!selectedRatee)   navigate("/rate-names/superior", { replace: true });
  }, [rater, token, selectedRatee, navigate]);

  // ── State — ids / names match original HTML exactly ───────────────────────
  // id="spc7freeform"  name="supercat7"
  const [spc7freeform, setSpc7freeform] = useState("");
  // id="spc8freeform"  name="supercat8"
  const [spc8freeform, setSpc8freeform] = useState("");
  // id="spc9radyes" / id="spc9radno"  name="supercat9"
  const [spc9radio, setSpc9radio] = useState("");

  const [formError,    setFormError]    = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function submitSurveyHandler() {
    if (!spc7freeform.trim() || !spc8freeform.trim()) {
      setFormError("Please fill in both Strengths and Areas of Improvements.");
      return;
    }
    if (!spc9radio) {
      setFormError("Please answer whether you are done rating all your ratees.");
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
      relationship:   "superior",
      period_id:      selectedPeriod?.id ?? null,
      submitted_date: today,
      answers:        answersArray,
      comments: {
        strengths:            spc7freeform.trim(),
        areas_of_improvement: spc8freeform.trim(),
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
        setFormError(`Submission failed: ${err.message ?? "Unknown error. Please try again."}`);
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
            <img src="/pvp.png" alt="logo" />
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
                <img src="/icon2.png" alt="superior" />
                <a>
                  <h5>You are rating Superior,</h5>
                  <h6>{rateeName}</h6>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Part 2 instruction card */}
        <div className="part-card">
          <h5>Part 2. Please write your qualitative responses based on the items below:</h5>
        </div>

        {/* Freeform & radio section */}
        <div className="container-card">
          <div className="container-card-inside">

            {/* Strengths — id="spc7freeform" name="supercat7" */}
            <div className="c7_card">
              <label htmlFor="spc7freeform">Strengths</label>
              <textarea
                id="spc7freeform"
                name="supercat7"
                placeholder="Enter text here..."
                required
                value={spc7freeform}
                onChange={(e) => setSpc7freeform(e.target.value)}
              />
            </div>

            {/* Areas of Improvements — id="spc8freeform" name="supercat8" */}
            <div className="c8_card">
              <label htmlFor="spc8freeform">Areas of Improvements</label>
              <textarea
                id="spc8freeform"
                name="supercat8"
                placeholder="Enter text here..."
                required
                value={spc8freeform}
                onChange={(e) => setSpc8freeform(e.target.value)}
              />
            </div>

            {/* Done rating all ratees? — name="supercat9" */}
            <div className="c9_card">
              <h3>Are you done rating all your ratees?</h3>
              <div className="c9_cardyes_no">
                <div>
                  <label className="radio-label" htmlFor="spc9radyes">
                    <input
                      type="radio"
                      id="spc9radyes"
                      value="yes"
                      name="supercat9"
                      className="radio-inputc9sp"
                      required
                      checked={spc9radio === "yes"}
                      onChange={() => setSpc9radio("yes")}
                    />
                    <span></span>
                    <div className="c9spyes">Yes, I&apos;m done.</div>
                  </label>
                </div>

                <div>
                  <label className="radio-label" htmlFor="spc9radno">
                    <input
                      type="radio"
                      id="spc9radno"
                      value="no"
                      name="supercat9"
                      className="radio-inputc9sp"
                      required
                      checked={spc9radio === "no"}
                      onChange={() => setSpc9radio("no")}
                    />
                    <span></span>
                    <div className="c9spno">No, not yet.</div>
                  </label>
                </div>
              </div>
            </div>

            {/* Reminder */}
            <div className="c8c9reminder">
              <a><b>Reminder: </b><b style={{ color: "red" }}>Do not click DONE</b> until you have completed all the evaluation.</a>
            </div>

            {/* Validation error */}
            {formError && (
              <p style={{ color: "red", textAlign: "center", margin: "10px 0" }}>{formError}</p>
            )}

            {/* Navigation buttons */}
            <div className="buttons">
              <button
                className="prev"
                onClick={() => navigate("/survey-cat-superior/6")}
                disabled={isSubmitting}
              >
                &laquo; Prev
              </button>
              <button
                className="done"
                onClick={submitSurveyHandler}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Done \u2714"}
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-col">
          <h4>Premier Value Provider Inc.</h4>
          <p>Boost productivity and well-being in your
            <br /> workplace with Premier Value Provider! Join us
            <br />in building a thriving workplace culture.</p>
          <div className="icon-links">
            <a href="https://www.linkedin.com/company/pvpi/mycompany/?viewAsMember=true" className="fa fa-linkedin"></a>
            <a href="https://www.facebook.com/pvpiph" className="fa fa-facebook"></a>
            <a href="https://www.instagram.com/pvpi.ph/" className="fa fa-instagram"></a>
            <a href="https://www.youtube.com/@pvptv636" className="fa fa-youtube"></a>
            <p>©2024 Premier Value Provider, Inc. <br /> All Rights reserved.</p>
          </div>
        </div>
      </footer>

    </body>
  );
}