import { Message } from "../models/Message.model.js";
import { User } from "../models/User.model.js";
import { Task } from "../models/Task.model.js";
import { Company } from "../models/Company.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// Send a message
export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, taskId, subject, message } = req.body;
  const senderId = req.user._id;

  if (!receiverId) {
    throw new ApiError(400, "Receiver is required");
  }

  if (!message || !message.trim()) {
    throw new ApiError(400, "Message content is required");
  }

  // Verify receiver exists
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new ApiError(404, "Receiver not found");
  }

  // Verify task exists if provided
  if (taskId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
  }

  const newMessage = await Message.create({
    sender: senderId,
    receiver: receiverId,
    task: taskId || undefined,
    subject: subject || "",
    message: message.trim(),
  });

  // Populate sender and task info for response
  const populatedMessage = await Message.findById(newMessage._id)
    .populate("sender", "name email")
    .populate("task", "title taskNumber");

  res.status(201).json(
    new ApiResponse(201, populatedMessage, "Message sent successfully")
  );
});

// Get messages for the logged-in user (received messages)
export const getReceivedMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const messages = await Message.find({ receiver: userId })
    .populate("sender", "name email")
    .populate("task", "title taskNumber")
    .sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(200, messages, "Messages fetched successfully")
  );
});

// Get sent messages by the logged-in user
export const getSentMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const messages = await Message.find({ sender: userId })
    .populate("receiver", "name email")
    .populate("task", "title taskNumber")
    .sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(200, messages, "Sent messages fetched successfully")
  );
});

// Mark a message as read
export const markAsRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findOne({ _id: messageId, receiver: userId });

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  message.read = true;
  message.readAt = new Date();
  await message.save();

  res.status(200).json(
    new ApiResponse(200, message, "Message marked as read")
  );
});

// Get unread message count for the logged-in user
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const count = await Message.countDocuments({ receiver: userId, read: false });

  res.status(200).json(
    new ApiResponse(200, { count }, "Unread count fetched successfully")
  );
});

// Get all users in the same company (for selecting recipients)
export const getCompanyUsers = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.companyId) {
    throw new ApiError(400, "You are not associated with any company");
  }

  const users = await User.find({
    companyId: user.companyId,
    _id: { $ne: user._id },
  }).select("name email");

  res.status(200).json(
    new ApiResponse(200, users, "Company users fetched successfully")
  );
});

// Get tasks for the logged-in user (for selecting task context)
export const getUserTasks = asyncHandler(async (req, res) => {
  const user = req.user;
  let query = {};

  // Compute roles from DB since JWT middleware doesn't set isCompanyAdmin/isProjectLead
  let isCompanyAdmin = false;
  let isProjectLead = false;

  if (user.companyId) {
    const company = await Company.findById(user.companyId);
    if (company) {
      isCompanyAdmin =
        company.owner.toString() === user._id.toString() ||
        company.admins.some((a) => a.toString() === user._id.toString());
    }
    const leadCount = await ProjectMember.countDocuments({
      userId: user._id,
      role: "lead",
    });
    isProjectLead = leadCount > 0;
  }

  // Company admin sees all tasks
  if (isCompanyAdmin) {
    query = {};
  }
  // Project lead sees tasks they assigned AND tasks assigned to them
  else if (isProjectLead) {
    query = { $or: [{ assignedBy: user._id }, { assignedTo: user._id }] };
  }
  // Regular member sees tasks assigned to them
  else {
    query = { assignedTo: user._id };
  }

  const tasks = await Task.find(query)
    .populate("projectId", "name")
    .populate("assignedTo", "name email")
    .select("title taskNumber projectId assignedTo status priority")
    .sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(200, tasks, "User tasks fetched successfully")
  );
});
