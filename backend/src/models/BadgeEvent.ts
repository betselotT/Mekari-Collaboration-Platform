import mongoose, { Document, Schema, Types } from "mongoose";

export type BadgeRefType = "thread" | "message" | "dm_session" | "point_event" | "user" | "other";

export interface IBadgeEvent extends Document {
  userId: Types.ObjectId;
  badge: string;
  refId?: Types.ObjectId;
  refType?: BadgeRefType;
  earnedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BadgeEventSchema = new Schema<IBadgeEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    badge: { type: String, required: true, trim: true, index: true },
    refId: { type: Schema.Types.ObjectId },
    refType: {
      type: String,
      enum: ["thread", "message", "dm_session", "point_event", "user", "other"],
    },
    earnedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

BadgeEventSchema.index({ userId: 1, badge: 1 });
BadgeEventSchema.index({ userId: 1, earnedAt: -1 });
BadgeEventSchema.index({ badge: 1, earnedAt: -1 });
BadgeEventSchema.index({ refId: 1, refType: 1 });

export const BadgeEvent = mongoose.model<IBadgeEvent>("BadgeEvent", BadgeEventSchema);
