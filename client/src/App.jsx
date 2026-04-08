// client/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SelectRole from "./pages/company/SelectRole";
import SurveyLetter from "./pages/company/SurveyLetter";
import RateNames from "./pages/company/RateNames";
import SurveyCatPeer from "./pages/company/SurveyCatPeer";
import SurveyCatPeerComment from "./pages/company/SurveyCatPeerComment";
import SurveyCatSubordinate from "./pages/company/SurveyCatSubordinate";
import SurveyCatSubordinateComment from "./pages/company/SurveyCatSubordinateComment";
import SurveyCatSuperior from "./pages/company/SurveyCatSuperior";
import SurveyCatSuperiorComment from "./pages/company/SurveyCatSuperiorComment";
import SurveyTY from "./pages/company/SurveyTY";
import EmployeeList from "./pages/admin/EmployeeList";

// import AdminDashboard              from "./pages/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public ─────────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        {/* ── Default redirect (root → login) ────────────────────── */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ── Protected: role selection & survey letter ───────────── */}
        <Route path="/select-role" element={<SelectRole />} />
        <Route path="/survey-letter/:relationship" element={<SurveyLetter />} />
        <Route path="/rate-names/:relationship" element={<RateNames />} />

        {/* ── Protected: Peer survey (7 categories + comments) ────── */}
        <Route path="/survey-cat-peer/:catNumber" element={<SurveyCatPeer />} />
        <Route path="/survey-cat-peer-comment" element={<SurveyCatPeerComment />} />

        {/* ── Protected: Subordinate survey (7 categories + comments) */}
        <Route path="/survey-cat-subordinate/:catNumber" element={<SurveyCatSubordinate />} />
        <Route path="/survey-cat-subordinate-comment" element={<SurveyCatSubordinateComment />} />

        {/* ── Protected: Superior survey (7 categories + comments) ── */}
        <Route path="/survey-cat-superior/:catNumber" element={<SurveyCatSuperior />} />
        <Route path="/survey-cat-superior-comment" element={<SurveyCatSuperiorComment />} />

        {/* ── Protected: Thank-you page ────────────────────────────── */}
        <Route path="/survey-ty" element={<SurveyTY />} />

        {/* ── Future: Admin ────────────────────────────────────────── */}
        {/* <Route path="/admin" element={<AdminDashboard />} /> */}

        {/* ── Catch-all: any unmatched URL → login ─────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

        <Route path="/admin/employees" element={<EmployeeList />} />
      </Routes>
    </BrowserRouter>
  );
}