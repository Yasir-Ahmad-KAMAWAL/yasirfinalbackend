import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ProjectMember } from "../models/ProjectMember.model.js";

// Confirms req.user has ANY membership (lead or member) on the project.
// Used for routes both roles can access, where behavior branches inside the controller
// (e.g. fetching tasks — lead sees all, member sees only their own).
// Attaches the membership doc to req.membership so controllers can check .role.
export const requireProjectMember = asyncHandler(async (req, res, next) => {
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

  req.membership = membership;
  next();
});