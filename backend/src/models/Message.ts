import mongoose, { Document, Schema, Types } from "mongoose";

export type MessageType = "TEXT" | "CODE" | "IMAGE" | "FILE" | "SYSTEM_EVENT";

export interface IMessage extends Document {
  thread?: Types.ObjectId;
  conversation?: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  type: MessageType;
  attachmentUrl?: string;
  parentMessageId?: Types.ObjectId;
  readBy: Array<{
    user: Types.ObjectId;
    readAt: Date;
  }>;
  upvotes: Types.ObjectId[];
  isPinned: boolean;
  isFromAi: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    thread: { type: Schema.Types.ObjectId, ref: "Thread" },
    conversation: { type: Schema.Types.ObjectId, ref: "DmConversation" },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"],
      default: "TEXT",
    },
    attachmentUrl: { type: String },
    parentMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    readBy: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        readAt: { type: Date, default: Date.now, required: true },
      },
    ],
    upvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isPinned: { type: Boolean, default: false, index: true },
    isFromAi: { type: Boolean, default: false },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

MessageSchema.pre("validate", function (next) {
  const hasThread = Boolean(this.thread);
  const hasConversation = Boolean(this.conversation);

  if (hasThread === hasConversation) {
    next(new Error("Message must belong to exactly one thread or DM conversation"));
    return;
  }

  next();
});

MessageSchema.index({ thread: 1, createdAt: 1 });
MessageSchema.index({ conversation: 1, createdAt: 1 });
MessageSchema.index({ thread: 1, sender: 1, "readBy.user": 1 });
MessageSchema.index({ conversation: 1, sender: 1, "readBy.user": 1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
