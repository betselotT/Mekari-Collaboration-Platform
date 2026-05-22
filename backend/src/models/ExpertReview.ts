import mongoose, { Document, Schema, Types } from "mongoose";

export interface IExpertReview extends Document {
  expert: Types.ObjectId;
  reviewer: Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpertReviewSchema = new Schema<IExpertReview>(
  {
    expert: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (value: number) => Number.isInteger(value * 2),
        message: "Rating must use 0.5 increments.",
      },
    },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

ExpertReviewSchema.index({ expert: 1, createdAt: -1 });
ExpertReviewSchema.index({ expert: 1, rating: 1 });
ExpertReviewSchema.index({ reviewer: 1, expert: 1 });

export const ExpertReview = mongoose.model<IExpertReview>(
  "ExpertReview",
  ExpertReviewSchema
);
