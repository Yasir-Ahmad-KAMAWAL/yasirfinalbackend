import { Router } from "express";
import {
  getProjectMembers,
  addMember,
  removeMember,
} from "../controllers/projectMember.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireProjectLead } from "../middlewares/requireProjectLead.middleware.js";

const router = Router({ mergeParams: true });

// All member routes require login + lead status on this project
router.use(verifyJWT, requireProjectLead);

router.route("/").get(getProjectMembers).post(addMember);
router.route("/:userId").delete(removeMember);

export default router;