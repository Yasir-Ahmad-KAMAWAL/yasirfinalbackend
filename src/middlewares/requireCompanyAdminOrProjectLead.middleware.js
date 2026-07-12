import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Project } from "../models/Project.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { getCompanyAdminStatus } from "../utils/companyAdmin.js";

// Allows company admins OR the project's lead to proceed.
export const requireCompanyAdminOrProjectLead = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new ApiError(400, "projectId is required in the route params.");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  if (project.companyId.toString() !== req.user.companyId?.toString()) {
    throw new ApiError(403, "This project does not belong to your company.");
  }

  const { company, isAdmin } = await getCompanyAdminStatus(
    req.user._id,
    req.user.companyId
  );

  if (isAdmin) {
    req.company = company;
    return next();
  }

  const membership = await ProjectMember.findOne({
    projectId,
    userId: req.user._id,
    role: "lead",
  });

  if (membership) {
    req.membership = membership;
    return next();
  }

  throw new ApiError(
    403,
    "Only company admins or the project lead can perform this action."
  );
});
