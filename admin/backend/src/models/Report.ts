import mongoose, { Document, Schema, Types } from "mongoose";

export type ReportTargetType = "thread" | "message" | "user";
export type ReportStatus = "pending" | "resolved" | "struck" | "dismissed";

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason: string;
  actionTaken?: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: ["thread", "message", "user"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true, maxlength: 1000 },
    actionTaken: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "resolved", "struck", "dismissed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

export const Report = mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);
