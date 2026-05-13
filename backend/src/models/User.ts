import mongoose, { Document, Schema } from "mongoose";

export type ExpertiseArea = {
  subject: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
};

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  oauthProvider?: string;
  bio?: string;
  avatarUrl?: string;
  expertise: ExpertiseArea[];
  skillTags: string[];
  availabilityStatus: "online" | "busy" | "offline" | "in_session";
  points: number;
  badges: string[];
  role: "user" | "admin" | "learner" | "expert" | "mod";
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
    passwordHash: { type: String },
    googleId: { type: String, index: true },
    oauthProvider: { type: String },
    bio: { type: String },
    avatarUrl: { type: String },
    expertise: { type: [ExpertiseSchema], default: [] },
    skillTags: { type: [String], default: [] },
    availabilityStatus: {
      type: String,
      enum: ["online", "busy", "offline", "in_session"],
      default: "offline",
    },
    points: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    role: {
      type: String,
      enum: ["user", "admin", "learner", "expert", "mod"],
      default: "user",
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
