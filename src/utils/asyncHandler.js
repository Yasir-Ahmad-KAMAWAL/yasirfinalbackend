// Wraps async route handlers so we don't need try/catch in every controller.
// Any thrown error (or rejected promise) is passed to Express's error middleware.
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };