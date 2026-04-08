// client/src/pages/company/SurveyCatSuperior.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Consolidates: surveycat1super.html → surveycat6super.html  (6 radio categories)
// CSS rename  : survey2.css  →  SurveyCatSuperior.css  (content unchanged)
// Route       : /survey-cat-superior/:catNumber   (catNumber = 1 – 6)
//
// Backend integration:
//   • On mount (cat 1 only) calls GET /api/v1/survey/status to block
//     raters who already submitted for this ratee+relationship.
//   • Per-category answers are kept in Zustand (surveyStore) until
//     SurveyCatSuperiorComment fires the final POST /api/v1/survey/submit.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSurveyStore from "../../store/surveyStore";
import { getSurveyStatus } from "../../api/survey";
import "../../assets/company/SurveyCatSuperior.css";   // ← same content as survey2.css

// =============================================================================
// CATEGORY DATA  ── ids, text, and ordering match original HTML files exactly
// =============================================================================
const CATEGORIES = {
  1: {
    catTitle:  "Achieving Results",
    partLabel: "PART 1 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    rednote:   null,
    questions: [
      { id: "super1.1", text: "Identifies what needs to be done and doing it before being asked or before the situation requires it." },
      { id: "super1.2", text: "Demonstrates concern for satisfying one\u2019s external and/or internal customers." },
      { id: "super1.3", text: "Focuses on results and desired outcomes and how best to achieve them. Gets the job done." },
      { id: "super1.4", text: "Ensures that one\u2019s own and others\u2019 work and information are complete and accurate; carefully preparing for meetings and presentations." },
      { id: "super1.5", text: "Displays ability to make difficult decisions in a timely manner." },
      { id: "super1.6", text: "Shows willingness to take calculated risks to achieve business goals." },
    ],
  },
  2: {
    catTitle:  "Solving Problems",
    partLabel: "PART 1 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    rednote:   null,
    questions: [
      { id: "super2.1", text: "Tackles a problem by using a logical, systematic, sequential approach." },
      { id: "super2.2", text: "Anticipates the implications and consequences of situations and take appropriate action to be prepared for possible contingencies." },
      { id: "super2.3", text: "Is resourceful in seeking solutions and addressing work problems and concerns." },
      { id: "super2.4", text: "Makes timely, informed decisions that take into account the facts, goals, constraints, and risks." },
      { id: "super2.5", text: "Develops fresh ideas that provide solutions to all types of workplace challenges." },
    ],
  },
  3: {
    catTitle:  "Communication",
    partLabel: "PART 1 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    rednote:   null,
    questions: [
      { id: "super3.1", text: "Expresses oneself clearly in conversations and interactions with others." },
      { id: "super3.2", text: "Expresses oneself clearly in written outputs." },
    ],
  },
  4: {
    catTitle:  "Personal Effectiveness",
    partLabel: "PART 1 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    rednote:   null,
    questions: [
      { id: "super4.1", text: "Takes personal responsibility for the quality and timeliness of work, and achieves results with little oversight." },
      { id: "super4.2", text: "Manages own time, priorities, and resources to achieve goals." },
      { id: "super4.3", text: "Maintains composure in highly stressful or adverse situations." },
      { id: "super4.4", text: "Diligently attends to details and pursues quality in accomplishing tasks." },
    ],
  },
  5: {
    catTitle:  "Leadership",
    partLabel: "PART 1 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    rednote:   "*Please rate if your ratee has subordinates and has leadership roles.",
    questions: [
      { id: "super5.1", text: "Inspires and motivates others to perform at their best." },
      { id: "super5.2", text: "Delegates responsibility and works with others and coach them to develop their capabilities." },
      { id: "super5.3", text: "Enables co-workers to grow and succeed through feedback, instruction, and encouragement." },
      { id: "super5.4", text: "Gains others\u2019 support for ideas, proposals, projects, and solutions." },
      { id: "super5.5", text: "Develops, maintains, and strengthens partnerships with others inside or outside the organization who can provide information, assistance, and support." },
      { id: "super5.6", text: "Effectively coordinates ideas and resources to achieve goals." },
      { id: "super5.7", text: "Manages staff in ways that improve their ability to succeed on the job." },
      { id: "super5.8", text: "Uses knowledge of the organizational and political climate to solve problems and accomplish goals." },
    ],
  },
  6: {
    catTitle:  "Core Values",
    partLabel: "PART 1 (Functional Competencies), the employee should be assessed on the extent to which he/she displays the competencies as described by their corresponding behaviors. The Rating Scale to be used for this section is shown below:",
    scale:     "functional",
    rednote:   null,
    questions: [
      { id: "super7.1",  text: "Articulates our team\u2019s purpose and goals." },
      { id: "super7.2",  text: "Does what is right and not what is \u201cright for me\u201d." },
      { id: "super7.3",  text: "Acknowledges that success or failure is a shared result." },
      { id: "super7.4",  text: "Freely communicates with peers." },
      { id: "super7.5",  text: "Makes plans before executing a project." },
      { id: "super7.6",  text: "Accomplishes tasks on or before the deadline." },
      { id: "super7.7",  text: "Aims for zero mistakes." },
      { id: "super7.8",  text: "Meets our clients\u2019 requirements." },
      { id: "super7.9",  text: "Shares knowledge and best practices with our co-workers." },
      { id: "super7.10", text: "Follows our process from start to finish and we do not do shortcuts." },
      { id: "super7.11", text: "Politely declines gifts from OFWs, big or small, and explains why." },
      { id: "super7.12", text: "Upholds company values despite extreme personal or professional pressure." },
      { id: "super7.13", text: "Is a role model." },
      { id: "super7.14", text: "Uses work hours for work." },
      { id: "super7.15", text: "Supports our company\u2019s advocacies." },
      { id: "super7.16", text: "Actively participates in our company\u2019s CSR activities." },
      { id: "super7.17", text: "Helps our community (employees, workers and families)." },
      { id: "super7.18", text: "Does what he/she promise to do." },
      { id: "super7.19", text: "Acts and contributes even when not required or expected." },
    ],
  },
};

// =============================================================================
// RATING SCALE DEFINITIONS  ── exact values/ids from original HTML preserved
// =============================================================================

// All Superior categories use the Rarely/Sometimes/Often/Most of the time/Always scale
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
// RADIO ROW — replicates original HTML naming conventions exactly:
//   label class  : "radio1" / "radio2" / ...  (per question index)
//   input class  : "radio__input" (q1) | "radio__input2" / "radio__input3" ... (q2+)
//   name attr    : "voting1" / "voting2" / ...
//   id attr      : "spc{catNum}q{qNum}{idSuffix}"  e.g. "spc3q1rad1", "spc5q2rad1.5"
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
        const inputId = `spc${catNum}q${qNum}${radio.idSuffix}`;
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
export default function SurveyCatSuperior() {
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
    if (!rater || !token) navigate("/login",              { replace: true });
    if (!selectedRatee)   navigate("/rate-names/superior", { replace: true });
  }, [rater, token, selectedRatee, navigate]);

  // ── Duplicate-submission guard (cat 1 only) ────────────────────────────────
  useEffect(() => {
    if (catNum !== 1 || !token || !selectedRatee) return;
    async function checkStatus() {
      try {
        const { is_submitted } = await getSurveyStatus(token, selectedRatee.id, "superior");
        if (is_submitted) navigate("/survey-ty", { replace: true });
      } catch (err) {
        console.error("Status check failed:", err.message);
      }
    }
    checkStatus();
  }, [catNum, token, selectedRatee, navigate]);

  const catData = CATEGORIES[catNum];
  const scale   = SCALE_FUNCTIONAL;

  // Initialise from store so back-navigation restores previous answers
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
      ? navigate("/rate-names/superior")
      : navigate(`/survey-cat-superior/${catNum - 1}`);
  }

  function handleNext() {
    const unanswered = catData.questions.filter((q) => !localAnswers[q.id]);
    if (unanswered.length > 0) {
      setFormError("Please answer all questions before proceeding.");
      return;
    }
    setFormError("");
    catNum === 6
      ? navigate("/survey-cat-superior-comment")
      : navigate(`/survey-cat-superior/${catNum + 1}`);
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

        {/* Red note (Leadership category) */}
        {catData.rednote && (
          <div className="rednote">
            <p style={{ color: "red", textAlign: "center", fontStyle: "italic", margin: "10px 0" }}>
              {catData.rednote}
            </p>
          </div>
        )}

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

        {/* Validation error */}
        {formError && (
          <p style={{ color: "red", textAlign: "center", margin: "10px 0" }}>{formError}</p>
        )}

        {/* Navigation buttons */}
        <div className="buttons">
          <button className="prev" onClick={handlePrev}>&laquo; Prev</button>
          <button className="next" onClick={handleNext}>Next &raquo;</button>
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