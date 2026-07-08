import mongoose, { Schema } from "mongoose";

const projectMemberSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["lead", "member"],
      required: true,
      default: "member",
    },
  },
  { timestamps: true }
);

// Prevent the same user from having two membership rows on the same project
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMember = mongoose.model("ProjectMember", projectMemberSchema);