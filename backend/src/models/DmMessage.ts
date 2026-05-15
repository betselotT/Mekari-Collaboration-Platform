import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDmMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  type: "TEXT";
  parentMessageId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DmMessageSchema = new Schema<IDmMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "DmConversation", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ["TEXT"], default: "TEXT" },
    parentMessageId: { type: Schema.Types.ObjectId, ref: "DmMessage" },
  },
  { timestamps: true }
);

DmMessageSchema.index({ conversation: 1, createdAt: 1 });

export const DmMessage = mongoose.model<IDmMessage>("DmMessage", DmMessageSchema);
