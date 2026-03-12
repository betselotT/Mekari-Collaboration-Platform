import mongoose, { Document, Schema } from "mongoose";

export type ExpertiseArea = {
  subject: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
};

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  bio?: string;
  avatarUrl?: string;
  expertise: ExpertiseArea[];
  availabilityStatus: "online" | "busy" | "offline";
  points: number;
  badges: string[];
  role: "user" | "admin";
}

const ExpertiseSchema = new Schema<ExpertiseArea>(
  {
    subject: { type: String, required: true },
    proficiency: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      required: true,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    bio: { type: String },
    avatarUrl: { type: String },
    expertise: { type: [ExpertiseSchema], default: [] },
    availabilityStatus: {
      type: String,
      enum: ["online", "busy", "offline"],
      default: "offline",
    },
    points: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);

