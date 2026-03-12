import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  thread: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  attachmentUrl?: string;
  isFromAi: boolean;
}

const MessageSchema = new Schema<IMessage>(
  {
    thread: { type: Schema.Types.ObjectId, ref: "Thread", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    attachmentUrl: { type: String },
    isFromAi: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>("Message", MessageSchema);

