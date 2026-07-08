import { Router } from "express";
import {
  createTask,
  getProjectTasks,
  updateTask,
  deleteTask,
} from "../controllers/task.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireProjectLead } from "../middlewares/requireProjectLead.middleware.js";
import { requireProjectMember } from "../middlewares/requireProjectMember.middleware.js";

const router = Router({ mergeParams: true });

// All task routes require login
router.use(verifyJWT);

router.route("/").get(requireProjectMember, getProjectTasks);
router.route("/").post(requireProjectLead, createTask);

router.route("/:taskId").patch(requireProjectMember, updateTask);
router.route("/:taskId").delete(requireProjectLead, deleteTask);

export default router;