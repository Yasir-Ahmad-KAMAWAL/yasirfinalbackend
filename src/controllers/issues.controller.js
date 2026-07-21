import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Project } from "../models/Project.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { Company } from "../models/Company.model.js";
import { Task } from "../models/Task.model.js";

// GET /api/issues/all
// Returns ALL tasks across all projects the user has access to.
//   - Company admins/owners see every task in the company.
//   - Project members (lead or member) see every task in their projects.
const getAllIssues = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Determine if user is a company admin/owner
  const company = await Company.findById(req.user.companyId);
  const isCompanyAdmin =
    company &&
    (company.owner.toString() === userId.toString() ||
      company.admins.some((a) => a.toString() === userId.toString()));

  // 2. Get project IDs where the user is a lead or member
  const memberships = await ProjectMember.find({
    userId,
  }).lean();
  const userProjectIds = memberships.map((m) => m.projectId);

  if (!isCompanyAdmin && userProjectIds.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No issues available."));
  }

  // 3. Build filter: admins see all company tasks, members/leads see their project tasks
  let filter;
  if (isCompanyAdmin) {
    // Get all projects in the company
    const companyProjects = await Project.find({
      companyId: req.user.companyId,
    }).lean();
    const allProjectIds = companyProjects.map((p) => p._id);
    filter = { projectId: { $in: allProjectIds } };
  } else {
    filter = { projectId: { $in: userProjectIds } };
  }

  const tasks = await Task.find({ ...filter, parentTask: null })
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("projectId", "name")
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

  // Map tasks to include projectName and subTaskCount
  const tasksWithProjectName = tasks.map((task) => {
    const taskObj = task.toObject();
    return {
      ...taskObj,
      projectName: task.projectId?.name || "Unknown",
      projectId: task.projectId?._id || task.projectId,
      subTaskCount: countMap[task._id.toString()] || 0,
    };
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, tasksWithProjectName, "All issues fetched successfully.")
    );
});

export { getAllIssues };