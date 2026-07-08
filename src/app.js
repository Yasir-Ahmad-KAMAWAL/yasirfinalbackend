import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// Routes
app.use("/api/auth", authRouter);

// Routes still to be mounted as we build them:
// app.use("/api/companies", companyRouter);
// app.use("/api/projects", projectRouter);
// app.use("/api/projects", projectMemberRouter);
// app.use("/api/tasks", taskRouter);

// Global error handler — must be the last app.use()
app.use(errorHandler);

export default app;