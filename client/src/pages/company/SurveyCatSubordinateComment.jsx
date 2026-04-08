// client/src/pages/company/SurveyCatSubordinateComment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Consolidates: surveycat8_9subor.html
// CSS rename  : peersurveycat8_9.css  →  SurveyCatSubordinateComment.css
// Route       : /survey-cat-subordinate-comment
//
// Differences from Peer comment page:
//   • 3 textareas: Strengths (sbc8), Areas of Improvements (sbc9),
//     Development Goals (sbc10)
//   • Yes/No radio: "Are you done rating all your ratees?" (sbc11)
//   • Reminder text: "Do not click DONE until you have completed all the evaluation."
//
// Backend integration:
//   • On submit calls POST /api/v1/survey/submit with all Zustand answers
//     + all three freeform comments.
//   • On success: clears survey state and navigates to /survey-ty.
//   • Handles 409 duplicate and other API errors gracefully.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import useSurveyStore          from "../../store/surveyStore";
import { submitSurvey }        from "../../api/survey";
import "../../assets/company/SurveyCatSubordinateComment.css";   // ← same content as peersurveycat8_9.css

export default function SurveyCatSubordinateComment() {
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
    if (!rater || !token) navigate("/login",                  { replace: true });
    if (!selectedRatee)   navigate("/rate-names/subordinate", { replace: true });
  }, [rater, token, selectedRatee, navigate]);

  // ── State — ids / names match original HTML exactly ───────────────────────
  // id="sbc8freeform"  name="suborcat8"
  const [sbc8freeform, setSbc8freeform] = useState("");
  // id="sbc9freeform"  name="suborcat9"
  const [sbc9freeform, setSbc9freeform] = useState("");
  // id="sbc10freeform" name="suborcat10"
  const [sbc10freeform, setSbc10freeform] = useState("");
  // id="sbc11radyes" / id="sbc11radno"  name="suborcat11"
  const [sbc11radio, setSbc11radio] = useState("");

  const [formError,    setFormError]    = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function submitSurveyHandler() {
    if (!sbc8freeform.trim() || !sbc9freeform.trim() || !sbc10freeform.trim()) {
      setFormError("Please fill in Strengths, Areas of Improvements, and Development Goals.");
      return;
    }
    if (!sbc11radio) {
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
      relationship:   "subordinate",
      period_id:      selectedPeriod?.id ?? null,
      date_evaluated: today,
      answers:        answersArray,
      comments: {
        strengths:            sbc8freeform.trim(),
        areas_of_improvement: sbc9freeform.trim(),
        development_goals:    sbc10freeform.trim(),
        done_rating_all:      sbc11radio,
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
                <img src="images/icon1.png" alt="subordinate" />
                <a>
                  <h5>You are rating Subordinate,</h5>
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

            {/* Strengths — id="sbc8freeform" name="suborcat8" */}
            <div className="c8_card">
              <label htmlFor="sbc8freeform">Strengths</label>
              <textarea
                id="sbc8freeform"
                name="suborcat8"
                placeholder="Enter text here..."
                required
                value={sbc8freeform}
                onChange={(e) => setSbc8freeform(e.target.value)}
              />
            </div>

            {/* Areas of Improvements — id="sbc9freeform" name="suborcat9" */}
            <div className="c9_card">
              <label htmlFor="sbc9freeform">Areas of Improvements</label>
              <textarea
                id="sbc9freeform"
                name="suborcat9"
                placeholder="Enter text here..."
                required
                value={sbc9freeform}
                onChange={(e) => setSbc9freeform(e.target.value)}
              />
            </div>

            {/* Development Goals — id="sbc10freeform" name="suborcat10" */}
            <div className="c10_card">
              <label htmlFor="sbc10freeform">Development Goals (Training, Special Projects, Development Assignments, Coaching etc.)</label>
              <textarea
                id="sbc10freeform"
                name="suborcat10"
                placeholder="Enter text here..."
                required
                value={sbc10freeform}
                onChange={(e) => setSbc10freeform(e.target.value)}
              />
            </div>

            {/* Done rating all ratees? — name="suborcat11" */}
            <div className="c11_card">
              <h3>Are you done rating all your ratees?</h3>
              <div className="c11_cardyes_no">
                <div>
                  <label className="radio-label" htmlFor="sbc11radyes">
                    <input
                      type="radio"
                      id="sbc11radyes"
                      value="yes"
                      name="suborcat11"
                      className="radio-inputc11sb"
                      required
                      checked={sbc11radio === "yes"}
                      onChange={() => setSbc11radio("yes")}
                    />
                    <span></span>
                    <div className="c11sbyes">Yes, I'm done.</div>
                  </label>
                </div>
                <div>
                  <label className="radio-label" htmlFor="sbc11radno">
                    <input
                      type="radio"
                      id="sbc11radno"
                      value="no"
                      name="suborcat11"
                      className="radio-inputc11sb"
                      required
                      checked={sbc11radio === "no"}
                      onChange={() => setSbc11radio("no")}
                    />
                    <span></span>
                    <div className="c11sbno">No, not yet.</div>
                  </label>
                </div>
              </div>
            </div>

            {formError && (
              <p style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>{formError}</p>
            )}

            <div className="c8c9reminder">
              <a><b>Reminder: </b><b style={{ color: "red" }}>Do not click DONE</b> until you have completed all the evaluation.</a>
            </div>

            <div className="buttons">
              <button className="prev" onClick={() => navigate("/survey-cat-subordinate/7")} disabled={isSubmitting}>&laquo; Prev</button>
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