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

export type NotificationChannelPreferences = {
  internal: boolean;
  push: boolean;
};

export type NotificationPreferences = {
  chat: NotificationChannelPreferences;
  documentStatus: NotificationChannelPreferences;
  moderation: NotificationChannelPreferences;
  admin: NotificationChannelPreferences;
};

export type PushToken = {
  token: string;
  provider: "fcm";
  platform: "web" | "admin_web";
  createdAt: Date;
  lastUsedAt: Date;
};

export type BadgeAchievement = {
  badge: string;
  refId: mongoose.Types.ObjectId;
  earnedAt: Date;
};

export type ExpertReview = {
  by: mongoose.Types.ObjectId;
  stars: number;
  comment?: string;
  createdAt: Date;
};

export type CertificateAchievement = {
  certificateId: string;
  title: string;
  description: string;
  milestone: string;
  issuedAt: Date;
  refId?: string;
};

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  githubId?: string;
  oauthProvider?: string;
  bio?: string;
  avatarUrl?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  devicesUsed: string[];
  collaborationGoals?: string;
  profileSetupCompleted: boolean;
  expertise: ExpertiseArea[];
  skillTags: string[];
  availabilityStatus: "online" | "busy" | "offline" | "in_session";
  expertVerification: ExpertVerification;
  notificationPreferences: NotificationPreferences;
  pushTokens: PushToken[];
  points: number;
  badges: string[];
  badgeCounts: Map<string, number>;
  badgeAchievements: BadgeAchievement[];
  reviews?: ExpertReview[];
  certificates: CertificateAchievement[];
  role: "user" | "admin" | "learner" | "expert" | "mod";
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
    platform: { type: String, enum: ["web", "admin_web"], default: "web" },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const BadgeAchievementSchema = new Schema<BadgeAchievement>(
  {
    badge: { type: String, required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    earnedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ExpertReviewSchema = new Schema<ExpertReview>(
  {
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (value: number) => Number.isInteger(value * 2),
        message: "Stars must use 0.5 increments.",
      },
    },
    comment: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CertificateAchievementSchema = new Schema<CertificateAchievement>(
  {
    certificateId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    milestone: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    refId: { type: String },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String },
    googleId: { type: String, index: true },
    githubId: { type: String, index: true },
    oauthProvider: { type: String },
    bio: { type: String },
    avatarUrl: { type: String },
    primaryTechnicalField: { type: String },
    roleOrStatus: { type: String },
    yearsOfExperience: { type: String },
    devicesUsed: { type: [String], default: [] },
    collaborationGoals: { type: String },
    profileSetupCompleted: { type: Boolean, default: false },
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
    notificationPreferences: {
      type: NotificationPreferencesSchema,
      default: () => ({}),
    },
    pushTokens: { type: [PushTokenSchema], default: [] },
    points: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    badgeCounts: {
      type: Map,
      of: Number,
      default: () => ({}),
    },
    badgeAchievements: { type: [BadgeAchievementSchema], default: [] },
    reviews: { type: [ExpertReviewSchema], default: undefined },
    certificates: { type: [CertificateAchievementSchema], default: [] },
    role: {
      type: String,
      enum: ["user", "admin", "learner", "expert", "mod"],
      default: "user",
    },
  },
  { timestamps: true }
);

UserSchema.index({ _id: 1, "badgeAchievements.badge": 1, "badgeAchievements.refId": 1 });
UserSchema.index({ _id: 1, "certificates.certificateId": 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
