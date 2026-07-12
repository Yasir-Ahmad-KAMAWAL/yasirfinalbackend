import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { Company } from "../models/Company.model.js";

// Allows both:
//   1. The project lead (role === "lead")
//   2. A company admin (owner or in company.admins array)
// to perform actions like creating/assigning tasks.
// The admin does NOT need to be a project member.
export const requireProjectLeadOrCompanyAdmin = asyncHandler(
  async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, "projectId is required in the route params.");
    }

    // 1) Check if user is a project lead
    const membership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (membership && membership.role === "lead") {
      req.membership = membership;
      return next();
    }

    // 2) Check if user is a company admin
    if (!req.user.companyId) {
      throw new ApiError(403, "You do not belong to any company.");
    }

    const company = await Company.findById(req.user.companyId);

    if (!company) {
      throw new ApiError(404, "Company not found.");
    }

    const isOwner = company.owner.toString() === req.user._id.toString();
    const isAdmin = company.admins.some(
      (adminId) => adminId.toString() === req.user._id.toString()
    );

    if (!isOwner && !isAdmin) {
      throw new ApiError(
        403,
        "Only the project lead or a company admin can perform this action."
      );
    }

    // The admin gets full control regardless of project membership.
    // If they happen to be a project member, keep the membership doc but
    // override its role to "admin" so downstream controllers work correctly.
    if (membership) {
      membership.role = "admin";
      req.membership = membership;
    } else {
      req.membership = { role: "admin", projectId, userId: req.user._id };
    }

    next();
  }
);