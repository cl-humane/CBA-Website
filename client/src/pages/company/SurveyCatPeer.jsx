// client/src/pages/company/SurveyCatPeer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Consolidates: surveycat1peer.html → surveycat7peer.html  (7 radio categories)
// CSS rename  : survey2.css  →  SurveyCatPeer.css  (content unchanged)
// Route       : /survey-cat-peer/:catNumber   (catNumber = 1 – 7)
//
// Backend integration:
//   • On mount (cat 1 only) calls GET /api/v1/survey/status to block
//     raters who already submitted for this ratee+relationship.
//   • Per-category answers are kept in Zustand (surveyStore) until
//     SurveyCatPeerComment fires the final POST /api/v1/survey/submit.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSurveyStore from "../../store/surveyStore";
import { getSurveyStatus } from "../../api/survey";
import "../../assets/company/SurveyCatPeer.css";

// =============================================================================
// CATEGORY DATA
// =============================================================================
const CATEGORIES = {
  1: {
    catTitle:  "Job Performance & Knowledge Category",
    partLabel: "PART 1 (Job Performance & Knowledge), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "jobperf",
    questions: [
      { id: "peer1.1", text: "Accomplishes volume of work assigned to him/her." },
      { id: "peer1.2", text: "Meets deadlines." },
      { id: "peer1.3", text: "Delivers work outputs that are accurate, thorough and of high quality." },
      { id: "peer1.4", text: "Has adequate knowledge & skills to perform expected work with minimal help." },
    ],
  },
  2: {
    catTitle:  "Achieving Results",
    partLabel: "PART 2 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    questions: [
      { id: "peer2.1", text: "Identifies what needs to be done and doing it before being asked or before the situation requires it." },
      { id: "peer2.2", text: "Demonstrates concern for satisfying one\u2019s external and/or internal customers." },
      { id: "peer2.3", text: "Focuses on results and desired outcomes and how best to achieve them. Gets the job done." },
      { id: "peer2.4", text: "Ensures that one\u2019s own and others\u2019 work and information are complete and accurate; carefully preparing for meetings and presentations." },
    ],
  },
  3: {
    catTitle:  "Solving Problems",
    partLabel: "PART 2 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    questions: [
      { id: "peer3.1", text: "Tackles a problem by using a logical, systematic, sequential approach." },
      { id: "peer3.2", text: "Anticipates the implications and consequences of situations and take appropriate action to be prepared for possible contingencies." },
      { id: "peer3.3", text: "Is resourceful in seeking solutions and addressing work problems and concerns." },
    ],
  },
  4: {
    catTitle:  "Communication",
    partLabel: "PART 2 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    questions: [
      { id: "peer4.1", text: "Expresses oneself clearly in conversations and interactions with others." },
      { id: "peer4.2", text: "Expresses oneself clearly in written outputs." },
    ],
  },
  5: {
    catTitle:  "Personal Effectiveness",
    partLabel: "PART 2 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    questions: [
      { id: "peer5.1", text: "Takes personal responsibility for the quality and timeliness of work, and achieves results with little oversight." },
      { id: "peer5.2", text: "Manages own time, priorities, and resources to achieve goals." },
      { id: "peer5.3", text: "Maintains composure in highly stressful or adverse situations." },
      { id: "peer5.4", text: "Diligently attends to details and pursues quality in accomplishing tasks." },
    ],
  },
  6: {
    catTitle:  "Leadership",
    partLabel: "PART 2 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    questions: [
      { id: "peer6.1", text: "Inspires and motivates others to perform at their best." },
      { id: "peer6.2", text: "Delegates responsibility and works with others and coach them to develop their capabilities." },
    ],
  },
  7: {
    catTitle:  "Core Values",
    partLabel: "PART 3 (Core Values), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    questions: [
      { id: "peer7.1",  text: "Speaks the truth even when it is difficult." },
      { id: "peer7.2",  text: "Tells us what we need to hear even if it\u2019s not what we want to hear." },
      { id: "peer7.3",  text: "Does not engage in gossip nor encourages it." },
      { id: "peer7.4",  text: "Does not talk about others behind their back in a negative way." },
      { id: "peer7.5",  text: "Acknowledges and takes responsibility for mistakes." },
      { id: "peer7.6",  text: "Complies with rules and regulations." },
      { id: "peer7.7",  text: "Does not abuse company resources." },
      { id: "peer7.8",  text: "Speaks up against dishonest or improper behavior." },
      { id: "peer7.9",  text: "Does not engage in dishonest or improper behavior." },
      { id: "peer7.10", text: "Follows our process from start to finish and we do not do shortcuts." },
      { id: "peer7.11", text: "Politely declines gifts from OFWs, big or small, and explains why." },
      { id: "peer7.12", text: "Upholds company values despite extreme personal or professional pressure." },
      { id: "peer7.13", text: "Is a role model." },
      { id: "peer7.14", text: "Uses work hours for work." },
      { id: "peer7.15", text: "Supports our company\u2019s advocacies." },
      { id: "peer7.16", text: "Actively participates in our company\u2019s CSR activities." },
      { id: "peer7.17", text: "Helps our community (employees, workers and families)." },
      { id: "peer7.18", text: "Does what he/she promise to do." },
      { id: "peer7.19", text: "Acts and contributes even when not required or expected." },
      { id: "peer7.20", text: "Does her/his best even outside of her/his comfort zone." },
      { id: "peer7.21", text: "Completes each task with equal energy whether it is pleasant or not." },
    ],
  },
};

// =============================================================================
// RATING SCALE DEFINITIONS
// =============================================================================
const SCALE_JOBPERF = {
  legendCols: 5,
  tableHeaders: ["1 or 1.5", "2 or 2.5", "3 or 3.5", "4 or 4.5", "5"],
  tableLabels:  ["Poor", "Unsatisfactory", "Satisfactory", "Very Good", "Outstanding"],
  tableDesc: [
    { cell: "1 or 1.5 (Poor)",           jsx: <><b>Fails</b> to meet minimum expectations</> },
    { cell: "2 or 2.5 (Unsatisfactory)",  jsx: <><b>Barely</b> meets minimum expectations; may be <b>less than satisfactory</b> in one or two significant areas</> },
    { cell: "3 or 3.5 (Satisfactory)",    jsx: <><b>Meets</b> minimum expectations</> },
    { cell: "4 or 4.5 (Very Good)",       jsx: <><b>Satisfactory performance</b> and <b>exceeds expectations</b> in one or two significant areas</> },
    { cell: "5 (Outstanding)",            jsx: <><b>Exceeds</b> expectations in <b>all</b> areas</> },
  ],
  radios: [
    { value: "1 Poor",             idSuffix: "rad1",   divClass: "radio__1",   divLabel: "1 - Poor" },
    { value: "1.5 Poor",           idSuffix: "rad1.5", divClass: "radio__1_5", divLabel: "1.5 - Poor" },
    { value: "2 Unsatisfactory",   idSuffix: "rad2",   divClass: "radio__2",   divLabel: "2 - Unsatisfactory" },
    { value: "2.5 Unsatisfactory", idSuffix: "rad2.5", divClass: "radio__2_5", divLabel: "2.5 - Unsatisfactory" },
    { value: "3. Satisfactory",    idSuffix: "rad3",   divClass: "radio__3",   divLabel: "3 - Satisfactory" },
    { value: "3.5 Satisfactory",   idSuffix: "rad3.5", divClass: "radio__3_5", divLabel: "3.5 - Satisfactory" },
    { value: "4 Very Good",        idSuffix: "rad4",   divClass: "radio__4",   divLabel: "4 - Very Good" },
    { value: "4.5 Very Good",      idSuffix: "rad4.5", divClass: "radio__4_5", divLabel: "4.5 - Very Good" },
    { value: "5 Outstanding",      idSuffix: "rad5",   divClass: "radio__5",   divLabel: "5 - Outstanding" },
    { value: "N/A",                idSuffix: "radNA",  divClass: "radio__NA",  divLabel: "N/A" },
  ],
};

const SCALE_FUNCTIONAL = {
  legendCols: 6,
  tableHeaders: ["1 or 1.5", "2 or 2.5", "3 or 3.5", "4 or 4.5", "5", "N/A"],
  tableLabels:  ["Rarely", "Sometimes", "Often", "Most of the time", "Always", "Not Applicable"],
  tableDesc: [
    { cell: "1 or 1.5 (Rarely)",          jsx: <><b>&lt;70%</b> of the time</> },
    { cell: "2 or 2.5 (Sometimes)",        jsx: <><b>70+%</b> of the time</> },
    { cell: "3 or 3.5 (Often)",            jsx: <><b>80+%</b> of the time</> },
    { cell: "4 or 4.5 (Most of the time)", jsx: <><b>90+%</b> of the time</> },
    { cell: "5 (Always)",                  jsx: <><b>100%</b> of the time</> },
    { cell: "N/A (Not Applicable)",        jsx: <><b>No</b> answer</> },
  ],
  radios: [
    { value: "1 Rarely",             idSuffix: "rad1",   divClass: "radio__1",   divLabel: "1 - Rarely" },
    { value: "1.5 Rarely",           idSuffix: "rad1.5", divClass: "radio__1_5", divLabel: "1.5 - Rarely" },
    { value: "2 Sometimes",          idSuffix: "rad2",   divClass: "radio__2",   divLabel: "2 - Sometimes" },
    { value: "2.5 Sometimes",        idSuffix: "rad2.5", divClass: "radio__2_5", divLabel: "2.5 - Sometimes" },
    { value: "3 Often",              idSuffix: "rad3",   divClass: "radio__3",   divLabel: "3 - Often" },
    { value: "3.5 Often",            idSuffix: "rad3.5", divClass: "radio__3_5", divLabel: "3.5 - Often" },
    { value: "4 Most of the time",   idSuffix: "rad4",   divClass: "radio__4",   divLabel: "4 - Most of the time" },
    { value: "4.5 Most of the time", idSuffix: "rad4.5", divClass: "radio__4_5", divLabel: "4.5 - Most of the time" },
    { value: "5 Always",             idSuffix: "rad5",   divClass: "radio__5",   divLabel: "5 - Always" },
    { value: "N/A",                  idSuffix: "radNA",  divClass: "radio__NA",  divLabel: "N/A" },
  ],
};

// =============================================================================
// RADIO ROW
// =============================================================================
function RadioRow({ catNum, question, qIndex, scale, currentValue, onChange }) {
  const qNum       = qIndex + 1;
  const labelClass = `radio${qNum}`;
  const inputClass = qNum === 1 ? "radio__input" : `radio__input${qNum}`;
  const votingName = `voting${qNum}`;

  return (
    <tr>
      <td className={`q${qNum}`} id={question.id}>{question.text}</td>
      {scale.radios.map((radio) => {
        const inputId = `prc${catNum}q${qNum}${radio.idSuffix}`;
        return (
          <td key={radio.idSuffix}>
            <label className={labelClass}>
              <input
                type="radio"
                name={votingName}
                value={radio.value}
                id={inputId}
                className={inputClass}
                required
                checked={currentValue === radio.value}
                onChange={() => onChange(question.id, radio.value)}
              />
              <span></span>
              <div className={radio.divClass}>{radio.divLabel}</div>
            </label>
          </td>
        );
      })}
    </tr>
  );
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================
export default function SurveyCatPeer() {
  const navigate      = useNavigate();
  const { catNumber } = useParams();
  const catNum        = parseInt(catNumber, 10);

  const rater         = useSurveyStore((s) => s.rater);
  const token         = useSurveyStore((s) => s.token);
  const selectedRatee = useSurveyStore((s) => s.selectedRatee);
  const setAnswer     = useSurveyStore((s) => s.setAnswer);
  const storeAnswers  = useSurveyStore((s) => s.answers);
  const logout        = useSurveyStore((s) => s.logout);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rater || !token) navigate("/login",           { replace: true });
    if (!selectedRatee)   navigate("/rate-names/peer", { replace: true });
  }, [rater, token, selectedRatee, navigate]);

  // ── Duplicate-submission guard (cat 1 only) ────────────────────────────────
  useEffect(() => {
    if (catNum !== 1 || !token || !selectedRatee) return;
    async function checkStatus() {
      try {
        const { is_submitted } = await getSurveyStatus(token, selectedRatee.id, "peer");
        if (is_submitted) navigate("/survey-ty", { replace: true });
      } catch (err) {
        console.error("Status check failed:", err.message);
      }
    }
    checkStatus();
  }, [catNum, token, selectedRatee, navigate]);

  const catData = CATEGORIES[catNum];
  const scale   = catData?.scale === "jobperf" ? SCALE_JOBPERF : SCALE_FUNCTIONAL;

  const [localAnswers, setLocalAnswers] = useState(() => {
    const init = {};
    catData?.questions.forEach((q) => {
      init[q.id] = storeAnswers[q.id]?.rawValue ?? "";
    });
    return init;
  });

  const [formError, setFormError] = useState("");

  function handleChange(questionId, rawValue) {
    setLocalAnswers((prev) => ({ ...prev, [questionId]: rawValue }));
    const isNa    = rawValue === "N/A";
    const numeric = isNa ? null : parseFloat(rawValue);
    setAnswer(questionId, numeric, isNa);
  }

  function handlePrev() {
    catNum === 1
      ? navigate("/rate-names/peer")
      : navigate(`/survey-cat-peer/${catNum - 1}`);
  }

  function submitSurvey() {
    const unanswered = catData.questions.filter((q) => !localAnswers[q.id]);
    if (unanswered.length > 0) {
      setFormError("Please answer all questions before proceeding.");
      return;
    }
    setFormError("");
    catNum === 7
      ? navigate("/survey-cat-peer-comment")
      : navigate(`/survey-cat-peer/${catNum + 1}`);
  }

  function handleLogout() { logout(); navigate("/login", { replace: true }); }

  if (!catData) return <p>Invalid category.</p>;

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

        {/* Category instruction */}
        <div className="category-card">
          <section className="category-instruction">
            <h3>{catData.catTitle}</h3>
            <h5>{catData.partLabel}</h5>
          </section>
        </div>

        {/* Rating scale legend table */}
        <div className="wrapper">
          <table>
            <tr>{scale.tableHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr>
            <tr>{scale.tableLabels.map((l, i)  => <th key={i}>{l}</th>)}</tr>
            <tr>
              {scale.tableDesc.map((d, i) => (
                <td key={i} data-cell={d.cell}><a>{d.jsx}</a></td>
              ))}
            </tr>
          </table>
        </div>

        {/* Voting radio table */}
        <div className="table-container">
          <table className="voting-table-radio">
            <tr>
              <th></th>
              <th>1</th><th>1.5</th><th>2</th><th>2.5</th>
              <th>3</th><th>3.5</th><th>4</th><th>4.5</th><th>5</th>
              <th>N/A</th>
            </tr>
            {catData.questions.map((q, idx) => (
              <RadioRow
                key={q.id}
                catNum={catNum}
                question={q}
                qIndex={idx}
                scale={scale}
                currentValue={localAnswers[q.id] ?? ""}
                onChange={handleChange}
              />
            ))}
          </table>
        </div>

        {formError && (
          <p style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>{formError}</p>
        )}

        {/* Nav buttons — same class names as original */}
        <div className="buttons">
          <button className="prev" onClick={handlePrev}>&laquo; Prev</button>
          <button className="next" onClick={submitSurvey}>Next &raquo;</button>
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