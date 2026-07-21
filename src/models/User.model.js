import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    refreshToken: {
      type: String,
    },
    securityQuestion: {
      type: String,
      required: true,
    },
    securityAnswer: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving, only if it was modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Hash security answer before saving, only if it was modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("securityAnswer")) return next();
  this.securityAnswer = await bcrypt.hash(this.securityAnswer, 10);
  next();
});

// Instance method to compare plain password with hashed password
userSchema.methods.isPasswordCorrect = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

// Instance method to compare plain security answer with hashed answer
userSchema.methods.isSecurityAnswerCorrect = async function (plainAnswer) {
  return await bcrypt.compare(plainAnswer, this.securityAnswer);
};

export const User = mongoose.model("User", userSchema);