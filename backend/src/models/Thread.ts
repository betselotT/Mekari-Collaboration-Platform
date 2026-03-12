import mongoose, { Document, Schema, Types } from "mongoose";

export interface IThread extends Document {
  title: string;
  subject: string;
  createdBy: Types.ObjectId;
  participants: Types.ObjectId[];
  isSolved: boolean;
  solvedBy?: Types.ObjectId;
  googleMeetLink?: string;
}

const ThreadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isSolved: { type: Boolean, default: false },
    solvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    googleMeetLink: { type: String },
  },
  { timestamps: true }
);

export const Thread = mongoose.model<IThread>("Thread", ThreadSchema);

