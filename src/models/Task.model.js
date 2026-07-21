import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    dueDate: {
      type: Date,
    },
    parentTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
  },
  { timestamps: true }
);

// Index for quickly finding sub-tasks of a parent
taskSchema.index({ parentTask: 1 });

export const Task = mongoose.model("Task", taskSchema);