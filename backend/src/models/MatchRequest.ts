import mongoose, { Document, Schema, Types } from "mongoose";

export type MatchAvailabilityPreference = "online_only" | "online_or_busy" | "any";

export type MatchConnectionPreference = "chat" | "voice_video" | "group_channel";

export type MatchRequestStatus = "open" | "matched" | "closed";

export type MatchQuestionnaire = {
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  devicesUsed?: string[];
  helpFrequency?: string;
  currentPlatformsUsed?: string[];
  biggestChallenges?: string[];
  connectionPreferences?: MatchConnectionPreference[];
  gamificationIncentives?: string[];
  usageVision?: string;
  accessibilityNeeds?: string[];
  crossDeviceImportance?: number; // 1-5
  excitement?: string;
  safetyConcerns?: string;
  contact?: {
    email?: string;
    telegramUsername?: string;
    phoneNumber?: string;
  };
};

export type MatchRecommendation = {
  expert: Types.ObjectId;
  score: number;
  reasons: string[];
};

export interface IMatchRequest extends Document {
  requester: Types.ObjectId;
  thread: Types.ObjectId;
  subject: string;
  tags: string[];
  availabilityPreference: MatchAvailabilityPreference;
  questionnaire?: MatchQuestionnaire;
  status: MatchRequestStatus;
  recommendations: MatchRecommendation[];
}

const MatchRecommendationSchema = new Schema<MatchRecommendation>(
  {
    expert: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    score: { type: Number, required: true, min: 0 },
    reasons: { type: [String], default: [] },
  },
  { _id: false }
);

const MatchRequestSchema = new Schema<IMatchRequest>(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    thread: { type: Schema.Types.ObjectId, ref: "Thread", required: true, index: true },
    subject: { type: String, required: true, index: true },
    tags: { type: [String], default: [], index: true },
    availabilityPreference: {
      type: String,
      enum: ["online_only", "online_or_busy", "any"],
      default: "online_or_busy",
    },
    questionnaire: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    status: { type: String, enum: ["open", "matched", "closed"], default: "open", index: true },
    recommendations: { type: [MatchRecommendationSchema], default: [] },
  },
  { timestamps: true }
);

MatchRequestSchema.index({ subject: 1, status: 1, createdAt: -1 });

export const MatchRequest = mongoose.model<IMatchRequest>(
  "MatchRequest",
  MatchRequestSchema
);

