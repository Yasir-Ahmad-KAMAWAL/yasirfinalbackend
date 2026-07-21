import { Router } from "express";
import {
  signupUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/signup").post(signupUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);

// Protected routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/me").get(verifyJWT, getCurrentUser);

export default router;
