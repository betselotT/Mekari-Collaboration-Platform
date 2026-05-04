import mongoose, { Document, Schema, Types } from "mongoose";

export type FeedbackEventType =
  | "thread_solved"
  | "ai_resolved"
  | "escalated_to_expert"
  | "expert_matched"
  | "expert_accepted"
  | "expert_rejected"
  | "message_upvoted"
  | "initial_analysis";

export interface FeedbackMetadata {
  timeToSolveMs?: number;
  solvedBy?: "ai" | "expert" | "self";
  aiConfidence?: number;
  expertMatchScore?: number;
  wasEscalated?: boolean;
  action?: "accepted" | "rejected" | "ignored";
  intent?: string;
  domain?: string;
  complexity?: string;
  tags?: string[];
  responseScore?: number;
}

export interface IFeedbackEvent extends Document {
  type: FeedbackEventType;
  threadId?: Types.ObjectId;
  userId?: Types.ObjectId;
  targetId?: Types.ObjectId;
  metadata: FeedbackMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackEventSchema = new Schema<IFeedbackEvent>(
  {
    type: {
      type: String,
      enum: [
        "thread_solved",
        "ai_resolved",
        "escalated_to_expert",
        "expert_matched",
        "expert_accepted",
        "expert_rejected",
        "message_upvoted",
        "initial_analysis",
      ],
      required: true,
      index: true,
    },
    threadId: { type: Schema.Types.ObjectId, ref: "Thread", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    targetId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

FeedbackEventSchema.index({ type: 1, createdAt: -1 });
FeedbackEventSchema.index({ userId: 1, type: 1 });
FeedbackEventSchema.index({ targetId: 1, type: 1 });

export const FeedbackEvent = mongoose.model<IFeedbackEvent>(
  "FeedbackEvent",
  FeedbackEventSchema
);
