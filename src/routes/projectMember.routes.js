import { Router } from "express";
import {
  getProjectMembers,
  addMember,
  removeMember,
} from "../controllers/projectMember.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireProjectLeadOrCompanyAdmin } from "../middlewares/requireProjectLeadOrCompanyAdmin.middleware.js";

const router = Router({ mergeParams: true });

// All member routes require login + lead or company admin status
router.use(verifyJWT, requireProjectLeadOrCompanyAdmin);

router.route("/").get(getProjectMembers).post(addMember);
router.route("/:userId").delete(removeMember);

export default router;