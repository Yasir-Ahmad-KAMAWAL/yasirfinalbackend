import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import companyRouter from "./routes/company.routes.js";
import projectRouter from "./routes/project.routes.js";
import projectMemberRouter from "./routes/projectMember.routes.js";
import taskRouter from "./routes/task.routes.js";
import issuesRouter from "./routes/issues.routes.js";
import favoritesRouter from "./routes/favorites.routes.js";
import messageRouter from "./routes/message.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/companies", companyRouter);
app.use("/api/projects", projectRouter);
app.use("/api/projects/:projectId/members", projectMemberRouter);
app.use("/api/projects/:projectId/tasks", taskRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/messages", messageRouter);

app.use(errorHandler);

export default app;