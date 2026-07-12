import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Project } from "../models/Project.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { User } from "../models/User.model.js";
import { Task } from "../models/Task.model.js";
import { getCompanyAdminStatus } from "../utils/companyAdmin.js";

const formatLead = (leadMembership) => {
  if (!leadMembership?.userId) return null;
  const user = leadMembership.userId;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
  };
};

const attachLeadInfo = async (projects) => {
  if (!projects.length) return [];

  const projectIds = projects.map((p) => p._id);
  const leadMemberships = await ProjectMember.find({
    projectId: { $in: projectIds },
    role: "lead",
  })
    .populate("userId", "name email")
    .lean();

  const leadByProjectId = Object.fromEntries(
    leadMemberships.map((m) => [m.projectId.toString(), formatLead(m)])
  );

  return projects.map((project) => ({
    ...project,
    lead: leadByProjectId[project._id.toString()] || null,
  }));
};


// POST /api/projects
// Only a company admin can create a project. They must pick an existing
// company user to be the lead — the creator does NOT automatically become lead.
// requireCompanyAdmin middleware runs before this.

const createProject = asyncHandler(async (req, res) => {
  const { name, description, leadUserId } = req.body;

  if (!name || !leadUserId) {
    throw new ApiError(400, "name and leadUserId are required.");
  }

  const leadUser = await User.findOne({
    _id: leadUserId,
    companyId: req.user.companyId,
  });

  if (!leadUser) {
    throw new ApiError(404, "Selected lead is not a user in your company.");
  }

  const project = await Project.create({
    name,
    description: description || "",
    companyId: req.user.companyId,
    createdBy: req.user._id,
  });

  await ProjectMember.create({
    projectId: project._id,
    userId: leadUser._id,
    role: "lead",
  });

  return res
    .status(201)
    .json(new ApiResponse(201, project, "Project created successfully."));
});

// GET /api/projects/my
// Company admins see every project in their company.
// Other users see only projects they belong to — powers the sidebar.
const getMyProjects = asyncHandler(async (req, res) => {
  const { isAdmin } = await getCompanyAdminStatus(
    req.user._id,
    req.user.companyId
  );

  let projects;

  if (isAdmin) {
    const companyProjects = await Project.find({
      companyId: req.user.companyId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const memberships = await ProjectMember.find({
      userId: req.user._id,
      projectId: { $in: companyProjects.map((p) => p._id) },
    }).lean();

    const membershipByProjectId = Object.fromEntries(
      memberships.map((m) => [m.projectId.toString(), m.role])
    );

    projects = companyProjects.map((project) => ({
      ...project,
      myRole: membershipByProjectId[project._id.toString()] || "admin",
    }));
  } else {
    const memberships = await ProjectMember.find({ userId: req.user._id })
      .populate("projectId")
      .lean();

    projects = memberships
      .filter((m) => m.projectId)
      .map((m) => ({
        ...m.projectId,
        myRole: m.role,
      }));
  }

  const projectsWithLead = await attachLeadInfo(projects);

  return res
    .status(200)
    .json(new ApiResponse(200, projectsWithLead, "Projects fetched successfully."));
});

// GET /api/projects/:projectId
// Basic project info — any project member (lead or member) can view.
// requireProjectMember middleware runs before this.
const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  const leadMembership = await ProjectMember.findOne({
    projectId: project._id,
    role: "lead",
  })
    .populate("userId", "name email")
    .lean();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...project.toObject(),
        myRole: req.membership.role,
        lead: formatLead(leadMembership),
      },
      "Project fetched successfully."
    )
  );
});

// PATCH /api/projects/:projectId
// Only the project lead can edit project details.
// requireProjectLead middleware runs before this.
const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.findByIdAndUpdate(
    req.params.projectId,
    { ...(name && { name }), ...(description !== undefined && { description }) },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully."));
});

// PATCH /api/projects/:projectId/lead
// Reassigns the project lead. Only a company admin can do this (the person
// appointing a new lead may not be a member of the project themselves).
// requireCompanyAdmin middleware runs before this.
const setProjectLead = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const { projectId } = req.params;

  if (!userId) {
    throw new ApiError(400, "userId is required.");
  }

  const project = await Project.findOne({
    _id: projectId,
    companyId: req.user.companyId,
  });

  if (!project) {
    throw new ApiError(404, "Project not found in your company.");
  }

  const newLeadUser = await User.findOne({
    _id: userId,
    companyId: req.user.companyId,
  });

  if (!newLeadUser) {
    throw new ApiError(404, "Selected user is not part of your company.");
  }

  // Demote the current lead (if one exists) to a plain member
  await ProjectMember.updateMany(
    { projectId, role: "lead" },
    { $set: { role: "member" } }
  );

  // Promote (or create) the new lead's membership
  const updatedMembership = await ProjectMember.findOneAndUpdate(
    { projectId, userId },
    { $set: { role: "lead" } },
    { new: true, upsert: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedMembership, "Project lead updated successfully.")
    );
});

// DELETE /api/projects/:projectId
// Fully deletes a project — including all its ProjectMember rows and Tasks.
// Allowed for company admins and the project lead.
// requireCompanyAdminOrProjectLead middleware runs before this.
const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findOne({
    _id: projectId,
    companyId: req.user.companyId,
  });

  if (!project) {
    throw new ApiError(404, "Project not found in your company.");
  }

  // Cascade delete — Mongoose doesn't do this automatically.
  await ProjectMember.deleteMany({ projectId });
  await Task.deleteMany({ projectId });
  await Project.findByIdAndDelete(projectId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully."));
});

export {
  createProject,
  getMyProjects,
  getProjectById,
  updateProject,
  setProjectLead,
  deleteProject,
};