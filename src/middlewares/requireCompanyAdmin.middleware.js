import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Company } from "../models/Company.model.js";

// Confirms req.user is the owner or an admin of their own company.
// Attaches the company doc to req.company for reuse in the controller.
export const requireCompanyAdmin = asyncHandler(async (req, res, next) => {
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
    throw new ApiError(403, "Only company admins can perform this action.");
  }

  req.company = company;
  next();
});