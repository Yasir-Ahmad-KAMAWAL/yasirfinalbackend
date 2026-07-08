import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.model.js";
import { Company } from "../models/Company.model.js";
import { generateAccessAndRefreshTokens } from "../utils/generateTokens.js";
import jwt from "jsonwebtoken";

// Cookie options used whenever we set accessToken/refreshToken cookies.
// httpOnly stops JS on the frontend from reading them (XSS protection).
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

// POST /api/auth/signup
// Two cases:
//   1. No companyId provided -> user is creating a brand new company, becomes its owner.
//   2. companyId provided -> user is joining an existing company as a plain employee.
const signupUser = asyncHandler(async (req, res) => {
  const { name, email, password, companyId, companyName } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required.");
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
    createdUser = await User.create({ name, email, password });

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
    });
  }

  const safeUser = await User.findById(createdUser._id).select(
    "-password -refreshToken"
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
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched."));
});

export { signupUser, loginUser, refreshAccessToken, logoutUser, getCurrentUser };