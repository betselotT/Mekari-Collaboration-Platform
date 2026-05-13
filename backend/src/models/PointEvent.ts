import mongoose, { Document, Schema, Types } from "mongoose";

export type PointEventType =
  | "ANSWERED_QUESTION"
  | "ANSWER_MARKED_SOLUTION"
  | "RECEIVED_UPVOTE"
  | "HELPED_IN_LIVE_SESSION"
  | "FIRST_ANSWER_OF_DAY";

export interface IPointEvent extends Document {
  userId: Types.ObjectId;
  eventType: PointEventType;
  points: number;
  refId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PointEventSchema = new Schema<IPointEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventType: {
      type: String,
      enum: [
        "ANSWERED_QUESTION",
        "ANSWER_MARKED_SOLUTION",
        "RECEIVED_UPVOTE",
        "HELPED_IN_LIVE_SESSION",
        "FIRST_ANSWER_OF_DAY",
      ],
      required: true,
    },
    points: { type: Number, required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

PointEventSchema.index({ userId: 1, eventType: 1, createdAt: -1 });

export const PointEvent = mongoose.model<IPointEvent>("PointEvent", PointEventSchema);
