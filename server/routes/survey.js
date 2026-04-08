// server/routes/survey.js
// Mounts at /api/v1/survey  (registered in app.js)
// All routes are protected — require a valid JWT.

import { Router }    from "express";
import authenticate  from "../middleware/auth.js";
import {
  getActivePeriod,
  getRatees,
  getSurveyStatus,
  submitSurvey,
} from "../controllers/surveyController.js";

const router = Router();

// All survey routes require authentication
router.use(authenticate);

// GET /api/v1/survey/period
// Returns the active evaluation_period row
router.get("/period", getActivePeriod);

// GET /api/v1/survey/ratees?relationship=subordinate|superior|peer
// Returns ratees the logged-in rater can evaluate, with is_submitted flag
router.get("/ratees", getRatees);

// GET /api/v1/survey/status?ratee_id=&relationship=
// Returns { is_submitted: boolean } — used on Cat 1 to block duplicate submissions
router.get("/status", getSurveyStatus);

// POST /api/v1/survey/submit
// Saves all answers + marks submission complete
// Body: { ratee_id, relationship, period_id?, date_evaluated, answers[], comments{} }
router.post("/submit", submitSurvey);

export default router;