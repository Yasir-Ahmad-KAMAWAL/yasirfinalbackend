import { Router } from "express";
import {
  createProject,
  getMyProjects,
  getProjectById,
  updateProject,
  setProjectLead,
  deleteProject,
} from "../controllers/project.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireCompanyAdmin } from "../middlewares/requireCompanyAdmin.middleware.js";
import { requireProjectLead } from "../middlewares/requireProjectLead.middleware.js";
import { requireProjectMember } from "../middlewares/requireProjectMember.middleware.js";

const router = Router();

// All project routes require login
router.use(verifyJWT);

router.route("/my").get(getMyProjects);
router.route("/").post(requireCompanyAdmin, createProject);

router.route("/:projectId").get(requireProjectMember, getProjectById);
router.route("/:projectId").patch(requireProjectLead, updateProject);
router.route("/:projectId").delete(requireCompanyAdmin, deleteProject);
router.route("/:projectId/lead").patch(requireCompanyAdmin, setProjectLead);

export default router;