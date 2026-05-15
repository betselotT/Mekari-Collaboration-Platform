import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDmConversation extends Document {
  participants: Types.ObjectId[];
  learner: Types.ObjectId;
  expert: Types.ObjectId;
  participantKey: string;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DmConversationSchema = new Schema<IDmConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator: (participants: Types.ObjectId[]) => participants.length === 2,
        message: "A DM conversation must have exactly two participants",
      },
      required: true,
    },
    learner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expert: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participantKey: { type: String, required: true, unique: true, index: true },
    lastMessagePreview: { type: String },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

DmConversationSchema.index({ participants: 1, updatedAt: -1 });

export const DmConversation = mongoose.model<IDmConversation>(
  "DmConversation",
  DmConversationSchema
);
