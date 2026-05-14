import mongoose, { Document, Schema, Types } from "mongoose";

type ExpertiseArea = {
  subject: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
};

type VerificationDocument = {
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  uploadedAt: Date;
};

type ExpertVerification = {
  status: "not_required" | "pending" | "approved" | "rejected";
  document?: VerificationDocument;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewNote?: string;
};

export interface IUser extends Document {
  name: string;
  email: string;
  role: "user" | "admin" | "learner" | "expert" | "mod";
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  devicesUsed: string[];
  collaborationGoals?: string;
  bio?: string;
  availabilityStatus: string;
  expertise: ExpertiseArea[];
  skillTags: string[];
  expertVerification: ExpertVerification;
  points: number;
  createdAt: Date;
  updatedAt: Date;
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
    email: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["user", "admin", "learner", "expert", "mod"],
      default: "user",
    },
    primaryTechnicalField: { type: String },
    roleOrStatus: { type: String },
    yearsOfExperience: { type: String },
    devicesUsed: { type: [String], default: [] },
    collaborationGoals: { type: String },
    bio: { type: String },
    availabilityStatus: { type: String, default: "offline" },
    expertise: { type: [ExpertiseSchema], default: [] },
    skillTags: { type: [String], default: [] },
    expertVerification: {
      type: ExpertVerificationSchema,
      default: () => ({ status: "not_required" }),
    },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
