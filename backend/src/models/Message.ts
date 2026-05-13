import mongoose, { Document, Schema, Types } from "mongoose";

export type MessageType = "TEXT" | "CODE" | "IMAGE" | "FILE" | "SYSTEM_EVENT";

export interface IMessage extends Document {
  thread: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  type: MessageType;
  attachmentUrl?: string;
  parentMessageId?: Types.ObjectId;
  upvotes: Types.ObjectId[];
  isFromAi: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    thread: { type: Schema.Types.ObjectId, ref: "Thread", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"],
      default: "TEXT",
    },
    attachmentUrl: { type: String },
    parentMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    upvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isFromAi: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ thread: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
