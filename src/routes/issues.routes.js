import { Router } from "express";
import { getAllIssues } from "../controllers/issues.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require login
router.use(verifyJWT);

router.route("/all").get(getAllIssues);

export default router;