import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ProjectMember } from "../models/ProjectMember.model.js";

// Confirms req.user is the 'lead' on the project identified by req.params.projectId.
// This is the gate for: adding/removing members, creating/assigning tasks, editing project.
// Attaches the membership doc to req.membership for reuse in the controller.
export const requireProjectLead = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new ApiError(400, "projectId is required in the route params.");
  }

  const membership = await ProjectMember.findOne({
    projectId,
    userId: req.user._id,
  });

  if (!membership) {
    throw new ApiError(403, "You are not a member of this project.");
  }

  if (membership.role !== "lead") {
    throw new ApiError(403, "Only the project lead can perform this action.");
  }

  req.membership = membership;
  next();
});