// server/routes/auth.js
// Mounts at /api/v1/auth  (registered in app.js)

import { Router }                                    from "express";
import { login, logout, verifyCode, register }       from "../controllers/authController.js";
import authenticate                                  from "../middleware/auth.js";

const router = Router();

// POST /api/v1/auth/login        — public
router.post("/login", login);

// POST /api/v1/auth/logout       — protected (must send a valid JWT)
router.post("/logout", authenticate, logout);

// POST /api/v1/auth/verify-code  — public: step 1 of registration (check email + code)
router.post("/verify-code", verifyCode);

// POST /api/v1/auth/register     — public: step 2 of registration (set password)
router.post("/register", register);

export default router;