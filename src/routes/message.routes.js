import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  sendMessage,
  getReceivedMessages,
  getSentMessages,
  markAsRead,
  getUnreadCount,
  getCompanyUsers,
  getUserTasks,
} from "../controllers/message.controller.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Send a message
router.post("/send", sendMessage);

// Get received messages
router.get("/received", getReceivedMessages);

// Get sent messages
router.get("/sent", getSentMessages);

// Get unread message count
router.get("/unread-count", getUnreadCount);

// Mark a message as read
router.patch("/:messageId/read", markAsRead);

// Get company users (for recipient selection)
router.get("/users", getCompanyUsers);

// Get user's assigned tasks (for task selection)
router.get("/my-tasks", getUserTasks);

export default router;