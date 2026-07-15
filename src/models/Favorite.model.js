import mongoose, { Schema } from "mongoose";

const favoriteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent the same user from favoriting the same task twice
favoriteSchema.index({ userId: 1, taskId: 1 }, { unique: true });

export const Favorite = mongoose.model("Favorite", favoriteSchema);