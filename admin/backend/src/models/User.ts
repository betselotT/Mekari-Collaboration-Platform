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

type NotificationChannelPreferences = {
  internal: boolean;
  push: boolean;
};

type NotificationPreferences = {
  chat: NotificationChannelPreferences;
  documentStatus: NotificationChannelPreferences;
  moderation: NotificationChannelPreferences;
  admin: NotificationChannelPreferences;
};

type PushToken = {
  token: string;
  provider: "fcm";
  platform: "web" | "admin_web";
  createdAt: Date;
  lastUsedAt: Date;
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
  notificationPreferences: NotificationPreferences;
  pushTokens: PushToken[];
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

const NotificationChannelPreferencesSchema = new Schema<NotificationChannelPreferences>(
  {
    internal: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
  },
  { _id: false }
);

const NotificationPreferencesSchema = new Schema<NotificationPreferences>(
  {
    chat: { type: NotificationChannelPreferencesSchema, default: () => ({}) },
    documentStatus: { type: NotificationChannelPreferencesSchema, default: () => ({}) },
    moderation: { type: NotificationChannelPreferencesSchema, default: () => ({}) },
    admin: { type: NotificationChannelPreferencesSchema, default: () => ({}) },
  },
  { _id: false }
);

const PushTokenSchema = new Schema<PushToken>(
  {
    token: { type: String, required: true },
    provider: { type: String, enum: ["fcm"], default: "fcm" },
    platform: { type: String, enum: ["web", "admin_web"], default: "admin_web" },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
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
    notificationPreferences: {
      type: NotificationPreferencesSchema,
      default: () => ({}),
    },
    pushTokens: { type: [PushTokenSchema], default: [] },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
