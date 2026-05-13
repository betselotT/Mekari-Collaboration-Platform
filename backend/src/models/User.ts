import mongoose, { Document, Schema } from "mongoose";

export type ExpertiseArea = {
  subject: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
};

export type VerificationDocument = {
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  uploadedAt: Date;
};

export type ExpertVerification = {
  status: "not_required" | "pending" | "approved" | "rejected";
  document?: VerificationDocument;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNote?: string;
};

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  oauthProvider?: string;
  bio?: string;
  avatarUrl?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  devicesUsed: string[];
  collaborationGoals?: string;
  expertise: ExpertiseArea[];
  skillTags: string[];
  availabilityStatus: "online" | "busy" | "offline" | "in_session";
  expertVerification: ExpertVerification;
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

const VerificationDocumentSchema = new Schema<VerificationDocument>(
  {
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    dataUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ExpertVerificationSchema = new Schema<ExpertVerification>(
  {
    status: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
    },
    document: { type: VerificationDocumentSchema },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String },
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
    primaryTechnicalField: { type: String },
    roleOrStatus: { type: String },
    yearsOfExperience: { type: String },
    devicesUsed: { type: [String], default: [] },
    collaborationGoals: { type: String },
    expertise: { type: [ExpertiseSchema], default: [] },
    skillTags: { type: [String], default: [] },
    availabilityStatus: {
      type: String,
      enum: ["online", "busy", "offline", "in_session"],
      default: "offline",
    },
    expertVerification: {
      type: ExpertVerificationSchema,
      default: () => ({ status: "not_required" }),
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
