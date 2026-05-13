import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  thread: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  type: string;
  isFromAi: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    thread: { type: Schema.Types.ObjectId, ref: "Thread", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    type: { type: String, default: "TEXT" },
    isFromAi: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
