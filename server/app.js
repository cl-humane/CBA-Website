// server/app.js
// Sets up Express, plugs in all middleware and routes.

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import surveyRoutes from "./routes/survey.js";
import adminRoutes from "./routes/admin/index.js";

const app = express();

// ── Startup env check ─────────────────────────────────────────────────────
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error("❌  Missing environment variables:", missingEnv.join(", "));
  console.error("    → Check your server/.env file and restart.");
  process.exit(1);
}

// ── Security middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// ── Root info ─────────────────────────────────────────────────────────────
app.get("/api/v1", (_req, res) => {
  res.json({
    status: "PVP 360 API is running ✅",
    version: "v1",
    endpoints: {
      health: "GET  /api/v1/health",
      login: "POST /api/v1/auth/login",
      logout: "POST /api/v1/auth/logout",
      activePeriod: "GET  /api/v1/survey/period",
      ratees: "GET  /api/v1/survey/ratees?relationship=peer|subordinate|superior",
      surveyStatus: "GET  /api/v1/survey/status?ratee_id=&relationship=",
      surveySubmit: "POST /api/v1/survey/submit",
    },
  });
});

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/survey", surveyRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/logos", express.static("public/logos"));

// Future routes:
// import reportRoutes from "./routes/reports.js";
// import adminRoutes  from "./routes/admin.js";
// app.use("/api/v1/reports", reportRoutes);
// app.use("/api/v1/admin",   adminRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error." });
});

export default app;