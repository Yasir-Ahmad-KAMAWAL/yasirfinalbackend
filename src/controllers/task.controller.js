import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Task } from "../models/Task.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";

// POST /api/projects/:projectId/tasks
// Only the lead can create/assign tasks. requireProjectLead middleware runs before this.
const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, priority, dueDate } = req.body;
  const { projectId } = req.params;

  if (!title || !assignedTo) {
    throw new ApiError(400, "title and assignedTo are required.");
  }

  // assignedTo must actually be a member of this project
  const assigneeMembership = await ProjectMember.findOne({
    projectId,
    userId: assignedTo,
  });

  if (!assigneeMembership) {
    throw new ApiError(400, "Assignee is not a member of this project.");
  }

  // Auto-generate sequential task number within the project
  const lastTask = await Task.findOne({ projectId }).sort({ taskNumber: -1 });
  const taskNumber = lastTask ? lastTask.taskNumber + 1 : 1;

  const task = await Task.create({
    projectId,
    taskNumber,
    title,
    description: description || "",
    assignedTo,
    assignedBy: req.user._id,
    priority: priority || "medium",
    dueDate,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created and assigned successfully."));
});

// GET /api/projects/:projectId/tasks
// THE key role-branching route:
//   - lead   -> sees every task in the project
//   - member -> sees only tasks assigned to them
// requireProjectMember middleware runs before this and attaches req.membership.
const getProjectTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const filter =
    req.membership.role === "lead"
      ? { projectId }
      : { projectId, assignedTo: req.user._id };

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .sort({ createdAt: -1 });

  // Ensure every task has a taskNumber (for legacy tasks)
  const tasksWithNumber = tasks.map((task) => {
    if (!task.taskNumber) {
      // Fallback: use the last 4 chars of the task ID as a number
      return { ...task.toObject(), taskNumber: parseInt(task._id.toString().slice(-4), 16) % 1000 || 1 };
    }
    return task;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, tasksWithNumber, "Tasks fetched successfully."));
});

// PATCH /api/projects/:projectId/tasks/:taskId
// Lead can edit anything on the task (reassign, priority, dueDate, status, etc).
// A plain member may only update the status of a task assigned to them.
// requireProjectMember middleware runs before this and attaches req.membership.
const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  if (req.membership.role === "lead") {
    const { title, description, assignedTo, status, priority, dueDate } = req.body;

    // If reassigning, make sure the new assignee is a project member
    if (assignedTo) {
      const assigneeMembership = await ProjectMember.findOne({
        projectId: task.projectId,
        userId: assignedTo,
      });
      if (!assigneeMembership) {
        throw new ApiError(400, "New assignee is not a member of this project.");
      }
    }

    Object.assign(task, {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(assignedTo && { assignedTo }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(dueDate !== undefined && { dueDate }),
    });
  } else {
    // Plain member: can only update status, and only on their own task
    if (task.assignedTo.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You can only update tasks assigned to you.");
    }

    const { status } = req.body;
    if (!status) {
      throw new ApiError(400, "status is required.");
    }

    task.status = status;
  }

  await task.save();

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task updated successfully."));
});

// DELETE /api/projects/:projectId/tasks/:taskId
// Only the lead can delete a task. Requires requireProjectLead in the route.
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);

  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Task deleted successfully."));
});

export { createTask, getProjectTasks, updateTask, deleteTask };