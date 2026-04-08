// client/src/pages/company/RateNames.jsx
import { useState, useEffect }        from "react";
import { useNavigate, useParams }     from "react-router-dom";
import useSurveyStore                 from "../../store/surveyStore";
import { getRatees, getActivePeriod } from "../../api/survey";
import "../../assets/company/RateNames.css";

const pvpLogo = "/pvp.png";

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

const CONFIG = {
  superior: {
    formTitle:      "Superior Assessment Form",
    partCardClass:  "part-card-super",
    raterCardClass: "ratersuper_card",
    rateeCardClass: "rateesuper_card",
    dateCardClass:  "datesuper_card",
    raterInputId:   "spffrater",
    raterInputName: "ratersp",
    rateeSelectId:  "spffratee",
    dateInputId:    "spdteval",
    dateInputName:  "spdteval",
    dateInputClass: "superdateeval",
    rateeLabel:     "Ratee / Superior (Person to Evaluate)",
    nextRoute:      "/survey-cat-superior/1",
  },
  subordinate: {
    formTitle:      "Subordinate Assessment Form",
    partCardClass:  "part-card-subor",
    raterCardClass: "ratersubor_card",
    rateeCardClass: "rateesubor_card",
    dateCardClass:  "datesubor_card",
    raterInputId:   "sbffrater",
    raterInputName: "ratersb",
    rateeSelectId:  "sbffratee",
    dateInputId:    "sbdteval",
    dateInputName:  "sbdteval",
    dateInputClass: "subordateeval",
    rateeLabel:     "Ratee / Subordinate (Person to Evaluate)",
    nextRoute:      "/survey-cat-subordinate/1",
  },
  peer: {
    formTitle:      "Peer Assessment Form",
    partCardClass:  "part-card-peer",
    raterCardClass: "raterpeer_card",
    rateeCardClass: "rateepeer_card",
    dateCardClass:  "datepeer_card",
    raterInputId:   "prffrater",
    raterInputName: "raterpr",
    rateeSelectId:  "prffratee",
    dateInputId:    "prdteval",
    dateInputName:  "prdteval",
    dateInputClass: "peerdateeval",
    rateeLabel:     "Ratee (Person to Evaluate)",
    nextRoute:      "/survey-cat-peer/1",   // ✅ fixed — matches SurveyCatPeer route
  },
};

// ── Inline error banner with specific guidance ────────────────────────────────
function ErrorBanner({ error, onRetry }) {
  if (!error) return null;

  let hint = null;
  if (error.status === 0) {
    hint = "👉 Make sure your backend server is running: cd server && npm run dev";
  } else if (error.status === 401) {
    hint = "👉 Your session expired. Please log out and log in again.";
  } else if (error.status === 404) {
    hint = "👉 No active evaluation period found. Ask an admin to activate a period in Supabase.";
  } else if (error.status === 500) {
    hint = "👉 Database error. Check your Supabase tables and RLS policies.";
  }

  return (
    <div style={{ color: "red", padding: "0.75rem 1rem", margin: "0.5rem auto", maxWidth: "400px", textAlign: "center" }}>
      <strong>Could not load ratees:</strong> {error.message}
      {hint && <div style={{ marginTop: "0.4rem", fontSize: "0.9em" }}>{hint}</div>}
      <br />
      <button onClick={onRetry} style={{ marginTop: "0.5rem" }}>Retry</button>
    </div>
  );
}

export default function RateNames() {
  const navigate         = useNavigate();
  const { relationship } = useParams();   // 'peer' | 'subordinate' | 'superior'

  const rater             = useSurveyStore((s) => s.rater);
  const token             = useSurveyStore((s) => s.token);
  const setSelectedRatee  = useSurveyStore((s) => s.setSelectedRatee);
  const setSelectedPeriod = useSurveyStore((s) => s.setSelectedPeriod);
  const logout            = useSurveyStore((s) => s.logout);

  // Auth guard
  useEffect(() => {
    if (!rater || !token) navigate("/login", { replace: true });
  }, [rater, token, navigate]);

  const cfg = CONFIG[relationship] ?? CONFIG.peer;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [raterName,  setRaterName]  = useState(rater?.full_name ?? "");
  const [rateeValue, setRateeValue] = useState("");
  const [dateEval,   setDateEval]   = useState(getTodayDate());
  const [formError,  setFormError]  = useState("");

  // ── Fetch state ─────────────────────────────────────────────────────────────
  const [ratees,     setRatees]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(null); // ApiError | null

  // ── Fetch ratees from Supabase via Express ────────────────────────────────
  async function fetchData() {
    if (!token || !relationship) return;
    setLoading(true);
    setFetchError(null);
    setRatees([]);

    try {
      // Both calls in parallel — faster load
      const [{ ratees: rateeList }, period] = await Promise.all([
        getRatees(token, relationship),
        getActivePeriod(token),
      ]);

      setSelectedPeriod(period);
      setRatees(rateeList);

      console.log(`✅ Loaded ${rateeList.length} ratee(s) for relationship="${relationship}"`);
    } catch (err) {
      console.error("❌ RateNames fetch error:", err.message, "| status:", err.status);
      setFetchError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [token, relationship]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handlePrev() {
    navigate(`/survey-letter/${relationship}`);
  }

  function handleNext() {
    if (!rateeValue) {
      setFormError("Please select a Ratee before proceeding.");
      return;
    }
    if (!dateEval) {
      setFormError("Please select a Date Evaluated before proceeding.");
      return;
    }
    setFormError("");

    const selected = ratees.find((r) => r.ratee_id === rateeValue);
    setSelectedRatee({
      id:        selected.ratee_id,
      full_name: selected.full_name,
    });
    useSurveyStore.setState({ dateEvaluated: dateEval });

    // ✅ Navigate to the correct survey route per relationship
    navigate(cfg.nextRoute);
  }

  const displayName = rater?.full_name ?? "User";

  return (
    <>
      {/* HEADER */}
      <header>
        <nav className="navbar">
          <a href="#" className="logo">
            <img src={pvpLogo} alt="PVP logo" />
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

      {/* CONTENT */}
      <div className="container-fliud">
        <div className="container" />

        <div className={cfg.partCardClass}>
          <h5>{cfg.formTitle}</h5>
        </div>

        <div className="container_whorate">
          <div className="whorate_card">
            <a>Unsure who to rate? Click this to know the</a>
            <a href="#"> List of Ratee-Rater</a>
          </div>
        </div>

        {/* Rater name */}
        <div className={cfg.raterCardClass}>
          <label htmlFor={cfg.raterInputId}>Rater (Your Name)</label>
          <input
            type="text"
            id={cfg.raterInputId}
            name={cfg.raterInputName}
            placeholder="Enter your name here..."
            value={raterName}
            onChange={(e) => setRaterName(e.target.value)}
            required
          />
        </div>

        {/* Ratee dropdown — live from Supabase */}
        <div className={cfg.rateeCardClass}>
          <label htmlFor={cfg.rateeSelectId}>{cfg.rateeLabel}</label>

          {/* Error banner with retry button */}
          <ErrorBanner error={fetchError} onRetry={fetchData} />

          {!fetchError && (
            <select
              id={cfg.rateeSelectId}
              value={rateeValue}
              onChange={(e) => setRateeValue(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">
                {loading ? "⏳ Loading ratees..." : "--Select Ratee--"}
              </option>
              {!loading && ratees.length === 0 && (
                <option disabled>No ratees assigned to you for this period</option>
              )}
              {ratees.map((r) => (
                <option
                  key={r.ratee_id}
                  value={r.ratee_id}
                  disabled={r.is_submitted}
                >
                  {r.full_name}{r.is_submitted ? " ✓ (Already Submitted)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date Evaluated — defaults to today, editable */}
        <div className={cfg.dateCardClass}>
          <label htmlFor={cfg.dateInputId}>Date Evaluated</label>
          <input
            type="date"
            id={cfg.dateInputId}
            name={cfg.dateInputName}
            className={cfg.dateInputClass}
            value={dateEval}
            onChange={(e) => setDateEval(e.target.value)}
            required
          />
        </div>

        {formError && (
          <p style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>
            {formError}
          </p>
        )}

        <div className="buttons">
          <button className="prev" onClick={handlePrev}>« Prev</button>
          <button className="next" onClick={handleNext} disabled={loading || !!fetchError}>
            Next »
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-col">
          <h4>Premier Value Provider Inc.</h4>
          <p>
            Boost productivity and well-being in your
            <br /> workplace with Premier Value Provider! Join us
            <br />in building a thriving workplace culture.
          </p>
          <div className="icon-links">
            <a href="https://www.linkedin.com/company/pvpi/mycompany/?viewAsMember=true" className="fa fa-linkedin" />
            <a href="https://www.facebook.com/pvpiph"    className="fa fa-facebook"  />
            <a href="https://www.instagram.com/pvpi.ph/" className="fa fa-instagram" />
            <a href="https://www.youtube.com/@pvptv636"  className="fa fa-youtube"   />
            <p>©2024 Premier Value Provider, Inc. <br /> All Rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}