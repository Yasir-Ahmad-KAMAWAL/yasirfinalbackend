import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.model.js";
import { Company } from "../models/Company.model.js";

// GET /api/companies/me
// Returns the current user's company info.
const getMyCompany = asyncHandler(async (req, res) => {
  if (!req.user.companyId) {
    throw new ApiError(404, "You do not belong to any company.");
  }

  const company = await Company.findById(req.user.companyId);

  if (!company) {
    throw new ApiError(404, "Company not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, company, "Company fetched successfully."));
});

// GET /api/companies/users
// Returns all users in the current user's company (name + email only).
// Used by leads to pick members to add to a project, and by admins to pick a project lead.
const getCompanyUsers = asyncHandler(async (req, res) => {
  if (!req.user.companyId) {
    throw new ApiError(403, "You do not belong to any company.");
  }

  const users = await User.find({ companyId: req.user.companyId }).select(
    "name email"
  );

  return res
    .status(200)
    .json(new ApiResponse(200, users, "Company users fetched successfully."));
});

export { getMyCompany, getCompanyUsers };