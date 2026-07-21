import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Project } from "../models/Project.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { getCompanyAdminStatus } from "../utils/companyAdmin.js";

// Confirms req.user has ANY membership (lead or member) on the project,
// or is a company admin viewing a project in their company.
// Attaches the membership doc to req.membership so controllers can check .role.
// If the user is a company admin AND a project member, the role is overridden
// to "admin" so they see all tasks (same as a lead would).
export const requireProjectMember = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new ApiError(400, "projectId is required in the route params.");
  }

  const membership = await ProjectMember.findOne({
    projectId,
    userId: req.user._id,
  });

  if (membership) {
    // If the user is a company admin, override their role to "admin"
    // so they see all tasks even if they were added as a plain member.
    const { isAdmin } = await getCompanyAdminStatus(req.user._id, req.user.companyId);
    if (isAdmin) {
      membership.role = "admin";
    }
    req.membership = membership;
    return next();
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  if (project.companyId.toString() !== req.user.companyId?.toString()) {
    throw new ApiError(403, "You are not a member of this project.");
  }

  const { isAdmin } = await getCompanyAdminStatus(req.user._id, req.user.companyId);
  if (isAdmin) {
    req.membership = { role: "admin" };
    return next();
  }

  throw new ApiError(403, "You are not a member of this project.");
});