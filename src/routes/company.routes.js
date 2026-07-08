import { Router } from "express";
import { getMyCompany, getCompanyUsers } from "../controllers/company.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All company routes require login
router.use(verifyJWT);

router.route("/me").get(getMyCompany);
router.route("/users").get(getCompanyUsers);

export default router;