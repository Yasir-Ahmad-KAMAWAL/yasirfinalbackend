import { ApiError } from "../utils/ApiError.js";

// Catches every error thrown/passed via next(err) in the app, including
// ApiError instances from controllers and unexpected errors (e.g. Mongoose validation).
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    error = new ApiError(statusCode, message, error.errors || []);
  }

  const response = {
    success: false,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};

export { errorHandler };