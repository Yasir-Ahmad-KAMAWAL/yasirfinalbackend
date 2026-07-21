import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Task } from "../models/Task.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";

// POST /api/projects/:projectId/tasks
// Only the lead/admin can create/assign tasks. requireProjectLeadOrCompanyAdmin middleware runs before this.
const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, priority, dueDate, parentTask } = req.body;
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

  // If this is a sub-task, verify the parent task exists and belongs to the same project
  if (parentTask) {
    const parent = await Task.findOne({ _id: parentTask, projectId });
    if (!parent) {
      throw new ApiError(400, "Parent task not found in this project.");
    }
  }

  // Auto-generate sequential task number within the project
  const lastTask = await Task.findOne({ projectId }).sort({ taskNumber: -1 });
  const lastTaskNumber = lastTask && typeof lastTask.taskNumber === "number" ? lastTask.taskNumber : 0;
  const taskNumber = lastTaskNumber + 1;

  const task = await Task.create({
    projectId,
    taskNumber,
    title,
    description: description || "",
    assignedTo,
    assignedBy: req.user._id,
    priority: priority || "medium",
    dueDate: dueDate || new Date(),
    parentTask: parentTask || null,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created and assigned successfully."));
});

// GET /api/projects/:projectId/tasks
// THE key role-branching route:
//   - lead/admin -> sees every top-level task in the project
//   - member -> sees only top-level tasks assigned to them
// requireProjectMember middleware runs before this and attaches req.membership.
const getProjectTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const canViewAllTasks =
    req.membership.role === "lead" || req.membership.role === "admin";

  const filter = canViewAllTasks
    ? { projectId, parentTask: null } // Only top-level tasks
    : { projectId, assignedTo: req.user._id, parentTask: null }; // Only top-level tasks assigned to me

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .sort({ createdAt: -1 });

  // Get sub-task counts for each task
  const taskIds = tasks.map((t) => t._id);
  const subTaskCounts = await Task.aggregate([
    { $match: { parentTask: { $in: taskIds } } },
    { $group: { _id: "$parentTask", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  subTaskCounts.forEach((item) => {
    countMap[item._id.toString()] = item.count;
  });

  // Ensure every task has a taskNumber (for legacy tasks)
  const tasksWithMeta = tasks.map((task) => {
    const taskObj = task.toObject();
    if (!taskObj.taskNumber) {
      taskObj.taskNumber = parseInt(task._id.toString().slice(-4), 16) % 1000 || 1;
    }
    taskObj.subTaskCount = countMap[task._id.toString()] || 0;
    return taskObj;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, tasksWithMeta, "Tasks fetched successfully."));
});

// GET /api/projects/:projectId/tasks/:taskId/subtasks
// Get sub-tasks of a specific task (sub-issues).
//   - lead/admin -> sees every sub-task of the parent
//   - member -> sees only sub-tasks assigned to them
// requireProjectMember middleware runs before this.
const getSubTasks = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  // Verify the parent task exists and belongs to this project
  const parentTask = await Task.findOne({ _id: taskId, projectId });
  if (!parentTask) {
    throw new ApiError(404, "Parent task not found in this project.");
  }

  const canViewAllTasks =
    req.membership.role === "lead" || req.membership.role === "admin";

  const filter = canViewAllTasks
    ? { parentTask: taskId, projectId }
    : { parentTask: taskId, projectId, assignedTo: req.user._id };

  const subTasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .sort({ createdAt: -1 });

  // Ensure every sub-task has a taskNumber
  const subTasksWithNumber = subTasks.map((task) => {
    if (!task.taskNumber) {
      return { ...task.toObject(), taskNumber: parseInt(task._id.toString().slice(-4), 16) % 1000 || 1 };
    }
    return task;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, subTasksWithNumber, "Sub-tasks fetched successfully."));
});

// POST /api/projects/:projectId/tasks/:taskId/subtasks
// Create a sub-task under an existing task. Only lead/admin can do this.
const createSubTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, priority, dueDate } = req.body;
  const { projectId, taskId } = req.params;

  if (!title || !assignedTo) {
    throw new ApiError(400, "title and assignedTo are required.");
  }

  // Verify the parent task exists and belongs to this project
  const parentTask = await Task.findOne({ _id: taskId, projectId });
  if (!parentTask) {
    throw new ApiError(404, "Parent task not found in this project.");
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
  const lastTaskNumber = lastTask && typeof lastTask.taskNumber === "number" ? lastTask.taskNumber : 0;
  const taskNumber = lastTaskNumber + 1;

  const subTask = await Task.create({
    projectId,
    taskNumber,
    title,
    description: description || "",
    assignedTo,
    assignedBy: req.user._id,
    priority: priority || "medium",
    dueDate: dueDate || new Date(),
    parentTask: taskId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, subTask, "Sub-task created successfully."));
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

  if (req.membership.role === "lead" || req.membership.role === "admin") {
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
// Only the lead/admin can delete a task. Requires requireProjectLeadOrCompanyAdmin in the route.
// Also deletes all sub-tasks under the task.
const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  // Cascade delete: remove all sub-tasks first, then the task itself
  await Task.deleteMany({ parentTask: taskId });
  await Task.findByIdAndDelete(taskId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Task and its sub-tasks deleted successfully."));
});

export { createTask, getProjectTasks, getSubTasks, createSubTask, updateTask, deleteTask };