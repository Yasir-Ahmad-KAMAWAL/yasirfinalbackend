import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.model.js";
import { Company } from "../models/Company.model.js";
import { ProjectMember } from "../models/ProjectMember.model.js";
import { generateAccessAndRefreshTokens } from "../utils/generateTokens.js";
import jwt from "jsonwebtoken";

// Cookie options used whenever we set accessToken/refreshToken cookies.
// httpOnly stops JS on the frontend from reading them (XSS protection).
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
];

// POST /api/auth/signup
// Two cases:
//   1. No companyId provided -> user is creating a brand new company, becomes its owner.
//   2. companyId provided -> user is joining an existing company as a plain employee.
const signupUser = asyncHandler(async (req, res) => {
  const { name, email, password, companyId, companyName, securityQuestion, securityAnswer } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required.");
  }

  if (!securityQuestion || !securityAnswer) {
    throw new ApiError(400, "Security question and answer are required.");
  }

  if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
    throw new ApiError(400, "Invalid security question selected.");
  }

  if (securityAnswer.length < 2) {
    throw new ApiError(400, "Security answer must be at least 2 characters.");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists.");
  }

  let resolvedCompanyId = companyId;

  // Case 2: joining an existing company
  if (companyId) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new ApiError(404, "Company not found.");
    }
  }

  // Case 1: creating a brand new company — user becomes its owner
  let createdUser;
  if (!companyId) {
    if (!companyName) {
      throw new ApiError(
        400,
        "companyName is required when creating a new company."
      );
    }

    // Create user first (without companyId), then create company, then link back.
    createdUser = await User.create({ name, email, password, securityQuestion, securityAnswer });

    const company = await Company.create({
      name: companyName,
      owner: createdUser._id,
      admins: [createdUser._id],
    });

    createdUser.companyId = company._id;
    await createdUser.save({ validateBeforeSave: false });
  } else {
    createdUser = await User.create({
      name,
      email,
      password,
      companyId: resolvedCompanyId,
      securityQuestion,
      securityAnswer,
    });
  }

  const safeUser = await User.findById(createdUser._id).select(
    "-password -refreshToken -securityAnswer"
  );

  return res
    .status(201)
    .json(new ApiResponse(201, safeUser, "User registered successfully."));
});

// POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required.");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Login successful."
      )
    );
});

// POST /api/auth/refresh-token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required.");
  }

  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token.");
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token. User no longer exists.");
  }

  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token does not match. Please log in again.");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken },
        "Access token refreshed."
      )
    );
});

// POST /api/auth/forgot-password
// Step 1: Verify email exists and return the user's security question
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required.");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "No account found with this email address.");
  }

  return res.status(200).json(
    new ApiResponse(200, { securityQuestion: user.securityQuestion }, "Security question found.")
  );
});

// POST /api/auth/reset-password
// Step 2: Verify security answer and reset the password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, securityAnswer, newPassword } = req.body;

  if (!email || !securityAnswer || !newPassword) {
    throw new ApiError(400, "Email, security answer, and new password are required.");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters.");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "No account found with this email address.");
  }

  const isAnswerCorrect = await user.isSecurityAnswerCorrect(securityAnswer);
  if (!isAnswerCorrect) {
    throw new ApiError(401, "Security answer is incorrect.");
  }

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Password reset successfully. Please log in with your new password.")
  );
});

// POST /api/auth/logout
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 },
  });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logged out successfully."));
});

// GET /api/auth/me
const getCurrentUser = asyncHandler(async (req, res) => {
  // Determine if user is a company admin/owner
  let isCompanyAdmin = false;
  let isProjectLead = false;
  
  if (req.user.companyId) {
    const company = await Company.findById(req.user.companyId);
    if (company) {
      isCompanyAdmin =
        company.owner.toString() === req.user._id.toString() ||
        company.admins.some((a) => a.toString() === req.user._id.toString());
    }
    
    // Check if user is a lead on any project
    const leadCount = await ProjectMember.countDocuments({
      userId: req.user._id,
      role: "lead",
    });
    isProjectLead = leadCount > 0;
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { ...req.user.toObject(), isCompanyAdmin, isProjectLead }, "Current user fetched.")
    );
});

export { signupUser, loginUser, refreshAccessToken, logoutUser, getCurrentUser, forgotPassword, resetPassword, SECURITY_QUESTIONS };
