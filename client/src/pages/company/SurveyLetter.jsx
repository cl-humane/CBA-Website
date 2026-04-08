// client/src/pages/company/SurveyLetter.jsx
// Single component replacing surveyletterpeer.html, surveylettersubordinate.html,
// and surveylettersuperior.html.
// The relationship is read from the URL param: /survey-letter/:relationship
// so clicking Peer, Subordinate, or Superior from SelectRole.jsx automatically
// shows the correct letter — no duplicate files needed.

import { useEffect }      from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSurveyStore     from "../../store/surveyStore";
import "../../assets/company/SurveyLetter.css";

const pvpLogo = "/pvp.png";

// Label map — matches ratee_rater_assignments.relationship ENUM values
const RELATIONSHIP_LABELS = {
  subordinate: "Subordinate",
  superior:    "Superior",
  peer:        "Peer",
};

export default function SurveyLetter() {
  const navigate             = useNavigate();
  const { relationship }     = useParams();          // 'subordinate' | 'superior' | 'peer'

  const rater    = useSurveyStore((s) => s.rater);
  const token    = useSurveyStore((s) => s.token);
  const logout   = useSurveyStore((s) => s.logout);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!rater || !token) {
      navigate("/login", { replace: true });
    }
  }, [rater, token, navigate]);

  // Capitalised label e.g. "Peer", "Subordinate", "Superior"
  const relationshipLabel = RELATIONSHIP_LABELS[relationship] ?? relationship;

  // Display name from users.full_name
  const displayName = rater?.full_name ?? "User";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleReturn() {
    navigate("/select-role");
  }

  function handleNext() {
    // Navigate to the rate-names page, keeping the relationship in the URL
    navigate(`/rate-names/${relationship}`);
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
        <div className="container">
          <div className="category-card">
            <div className="surveyletter">

              <p>Dear <b>{displayName}</b>,</p>
              <br /><br />
              <p>
                Welcome and good day. This is <b>{relationshipLabel}</b> Lorem ipsum dolor sit amet consectetur adipisicing
                <br /><br />
                Please answer honestly and objectively. There are no right or wrong answers here.
                Remember to rate the Peer/Subordinate/Superior based on his/her performance per item.
                Note that the coverage of the evaluation is from Lorem date to Loren date.
                <br /><br />
                Thank you very much for your participation and stay safe.
                <br /><br />
                If you have questions or clarifications, you may directly email the following:
                <br /><br />
                <b>Abbey Hinto</b>
                <br />
                Project Manager, PVP
                <br />
                alhinto@pvpi.ph
              </p>

            </div>
          </div>
        </div>

        {/* BUTTONS */}
        <div className="button">
          <div className="buttons">
            <button className="return" onClick={handleReturn}>
              ⬅ Return
            </button>
            <button className="next" onClick={handleNext}>
              Next »
            </button>
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