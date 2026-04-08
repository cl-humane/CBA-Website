// server/middleware/auth.js
// Verifies the JWT on every protected route.
// Attaches the decoded payload to req.user so controllers can read it.

import jwt from "jsonwebtoken";

export default function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];

  // Header must be: Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded shape: { sub, email, full_name, role, department_id, iat, exp }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

// ── Role guard helper ─────────────────────────────────────────────────────
// Usage in routes:  router.get("/admin/users", authenticate, requireAdmin, handler)
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}