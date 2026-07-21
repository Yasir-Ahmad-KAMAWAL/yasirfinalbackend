import { Router } from "express";
import {
  createTask,
  getProjectTasks,
  getSubTasks,
  createSubTask,
  updateTask,
  deleteTask,
} from "../controllers/task.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireProjectLeadOrCompanyAdmin } from "../middlewares/requireProjectLeadOrCompanyAdmin.middleware.js";
import { requireProjectMember } from "../middlewares/requireProjectMember.middleware.js";

const router = Router({ mergeParams: true });

// All task routes require login
router.use(verifyJWT);

// Top-level task routes
router.route("/").get(requireProjectMember, getProjectTasks);
router.route("/").post(requireProjectLeadOrCompanyAdmin, createTask);

// Single task operations
router.route("/:taskId").patch(requireProjectMember, updateTask);
router.route("/:taskId").delete(requireProjectLeadOrCompanyAdmin, deleteTask);

// Sub-task routes (nested under a task)
router.route("/:taskId/subtasks").get(requireProjectMember, getSubTasks);
router.route("/:taskId/subtasks").post(requireProjectLeadOrCompanyAdmin, createSubTask);

export default router;