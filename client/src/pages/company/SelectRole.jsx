// client/src/pages/company/SelectRole.jsx
// Converted from surveySelection.html — design unchanged.
// Reads the logged-in user from surveyStore, shows the 3 role cards,
// and navigates to the correct survey letter page on selection.

import { useEffect }       from "react";
import { useNavigate }     from "react-router-dom";
import useSurveyStore      from "../../store/surveyStore";
import "../../assets/company/Surveystyle.css";

// Images in /public are served at root — use URL strings, not JS imports
const pvpLogo = "/pvp.png";
const icon1   = "/icon1.png";
const icon2   = "/icon2.png";
const icon3   = "/icon3.png";

// Relationship values match the `ratee_rater_assignments.relationship` ENUM:
// 'subordinate' | 'superior' | 'peer'
const ROLE_CARDS = [
  {
    relationship: "subordinate",
    label:        "Subordinate",
    description:  "Take a survey for Subordinate",
    icon:         icon1,
    containerId:  "subordinate-container",
    path:         "/survey-letter/subordinate",
  },
  {
    relationship: "superior",
    label:        "Superior",
    description:  "Take a survey for Superior",
    icon:         icon2,
    containerId:  "superior-container",
    path:         "/survey-letter/superior",
  },
  {
    relationship: "peer",
    label:        "Peer",
    description:  "Take a survey for Peer",
    icon:         icon3,
    containerId:  "peer-container",
    path:         "/survey-letter/peer",
  },
];

export default function SelectRole() {
  const navigate          = useNavigate();
  const rater             = useSurveyStore((s) => s.rater);
  const token             = useSurveyStore((s) => s.token);
  const logout            = useSurveyStore((s) => s.logout);
  const setSelectedPeriod = useSurveyStore((s) => s.setSelectedPeriod);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!rater || !token) {
      navigate("/login", { replace: true });
    }
  }, [rater, token, navigate]);

  function handleSelectRole(card) {
    // Store the chosen relationship in the survey store so downstream
    // pages (RateNames, Category pages) can use it
    useSurveyStore.setState({ selectedRelationship: card.relationship });
    navigate(card.path);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  // Display name from users.full_name (stored as "Last, First MI")
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
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleLogout(); }}
              >
                Log out
              </a>
            </li>
          </ul>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <div className="container-fliud">

        {/* Instruction banner */}
        <div className="instruction">
          <h4>Instruction: Choose the role you want to rate.</h4>
        </div>

        {/* Role selection cards */}
        <div className="container">
          <div className="container_row">
            {ROLE_CARDS.map((card) => (
              <div className="col-md" id={card.containerId} key={card.relationship}>
                <div className="card">
                  <img src={card.icon} alt={card.label} />
                  <div className="card-body">
                    <h5>{card.label}</h5>
                    <p className="card-text">{card.description}</p>
                  </div>
                  <button
                    className="btn"
                    onClick={() => handleSelectRole(card)}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
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