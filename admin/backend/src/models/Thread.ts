import mongoose, { Document, Schema, Types } from "mongoose";

export interface IThread extends Document {
  title: string;
  subject: string;
  createdBy: Types.ObjectId;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, default: "OPEN" },
  },
  { timestamps: true }
);

export const Thread = mongoose.models.Thread || mongoose.model<IThread>("Thread", ThreadSchema);
