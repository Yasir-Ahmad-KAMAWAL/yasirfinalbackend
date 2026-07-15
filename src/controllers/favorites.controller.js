import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Favorite } from "../models/Favorite.model.js";
import { Task } from "../models/Task.model.js";
import { Company } from "../models/Company.model.js";
import { Project } from "../models/Project.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";

// POST /api/favorites/:taskId
// Toggle a task as favorite for the current user.
const toggleFavorite = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { taskId } = req.params;

  // Verify task exists
  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  const projectId = task.projectId;

  // Check if already favorited
  const existing = await Favorite.findOne({ userId, taskId });

  if (existing) {
    // Remove favorite
    await Favorite.deleteOne({ _id: existing._id });
    return res
      .status(200)
      .json(new ApiResponse(200, { favorited: false }, "Favorite removed."));
  } else {
    // Add favorite
    await Favorite.create({ userId, taskId, projectId });
    return res
      .status(200)
      .json(new ApiResponse(200, { favorited: true }, "Favorite added."));
  }
});

// GET /api/favorites
// Returns all favorited tasks for the current user.
//   - Admins: see all favorited tasks across the company
//   - Leads/Members: see only favorited tasks that are assigned to them
const getFavorites = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Determine if user is a company admin/owner
  const company = await Company.findById(req.user.companyId);
  const isCompanyAdmin =
    company &&
    (company.owner.toString() === userId.toString() ||
      company.admins.some((a) => a.toString() === userId.toString()));

  let favorites;

  if (isCompanyAdmin) {
    // Admin: get all favorites in the company
    const companyProjects = await Project.find({
      companyId: req.user.companyId,
    }).lean();
    const allProjectIds = companyProjects.map((p) => p._id);

    const favoriteDocs = await Favorite.find({
      projectId: { $in: allProjectIds },
    }).lean();

    const taskIds = favoriteDocs.map((f) => f.taskId);
    const tasks = await Task.find({ _id: { $in: taskIds } })
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .populate("projectId", "name")
      .sort({ createdAt: -1 });

    favorites = tasks.map((task) => ({
      ...task.toObject(),
      projectName: task.projectId?.name || "Unknown",
      projectId: task.projectId?._id || task.projectId,
    }));
  } else {
    // Lead/Member: get only favorites where task is assigned to them
    const favoriteDocs = await Favorite.find({ userId }).lean();
    const taskIds = favoriteDocs.map((f) => f.taskId);

    const tasks = await Task.find({
      _id: { $in: taskIds },
      assignedTo: userId,
    })
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .populate("projectId", "name")
      .sort({ createdAt: -1 });

    favorites = tasks.map((task) => ({
      ...task.toObject(),
      projectName: task.projectId?.name || "Unknown",
      projectId: task.projectId?._id || task.projectId,
    }));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, favorites, "Favorites fetched successfully."));
});

// GET /api/favorites/status
// Returns a list of task IDs that the current user has favorited.
// Used by the frontend to show which stars are filled.
const getFavoriteStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const favorites = await Favorite.find({ userId }).lean();
  const favoriteTaskIds = favorites.map((f) => f.taskId.toString());
  return res
    .status(200)
    .json(new ApiResponse(200, favoriteTaskIds, "Favorite status fetched."));
});

export { toggleFavorite, getFavorites, getFavoriteStatus };