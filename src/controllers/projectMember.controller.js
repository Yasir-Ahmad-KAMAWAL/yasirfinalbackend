import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { User } from "../models/User.model.js";

// GET /api/projects/:projectId/members
// Only the lead can see the full member roster.
// requireProjectLead middleware runs before this.
const getProjectMembers = asyncHandler(async (req, res) => {
  const members = await ProjectMember.find({
    projectId: req.params.projectId,
  }).populate("userId", "name email");

  return res
    .status(200)
    .json(new ApiResponse(200, members, "Project members fetched successfully."));
});

// POST /api/projects/:projectId/members
// Adds an existing company user to the project as a plain member.
// Only the lead can call this. requireProjectLead middleware runs before this.
const addMember = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const { projectId } = req.params;

  if (!userId) {
    throw new ApiError(400, "userId is required.");
  }

  // Make sure the user being added belongs to the same company as the lead
  const user = await User.findOne({
    _id: userId,
    companyId: req.user.companyId,
  });

  if (!user) {
    throw new ApiError(404, "Selected user is not part of your company.");
  }

  const existingMembership = await ProjectMember.findOne({ projectId, userId });
  if (existingMembership) {
    throw new ApiError(409, "This user is already a member of this project.");
  }

  const membership = await ProjectMember.create({
    projectId,
    userId,
    role: "member",
  });

  return res
    .status(201)
    .json(new ApiResponse(201, membership, "Member added to project."));
});

// DELETE /api/projects/:projectId/members/:userId
// Removes a member from the project. Only the lead can call this.
// A lead cannot remove themselves this way — leadership must be reassigned
// via the setProjectLead route instead, to avoid a project ending up leaderless.
const removeMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  const membership = await ProjectMember.findOne({ projectId, userId });

  if (!membership) {
    throw new ApiError(404, "This user is not a member of this project.");
  }

  if (membership.role === "lead") {
    throw new ApiError(
      400,
      "Cannot remove the project lead directly. Reassign leadership first."
    );
  }

  await ProjectMember.findByIdAndDelete(membership._id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Member removed from project."));
});

export { getProjectMembers, addMember, removeMember };