import mongoose, { Document, Schema, Types } from "mongoose";

export type DmSessionStatus = "creating" | "active" | "ended";

export interface DmSession {
  meetLink: string;
  meetSpaceName?: string;
  status: DmSessionStatus;
  startedBy: Types.ObjectId;
  startedAt: Date;
  endedBy?: Types.ObjectId;
  endedAt?: Date;
}

export interface IDmConversation extends Document {
  participants: Types.ObjectId[];
  learner: Types.ObjectId;
  expert: Types.ObjectId;
  participantKey: string;
  activeSession?: DmSession;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DmSessionSchema = new Schema<DmSession>(
  {
    meetLink: { type: String, required: true },
    meetSpaceName: { type: String },
    status: {
      type: String,
      enum: ["creating", "active", "ended"],
      default: "active",
      required: true,
    },
    startedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: Date.now, required: true },
    endedBy: { type: Schema.Types.ObjectId, ref: "User" },
    endedAt: { type: Date },
  },
  { _id: false }
);

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
    activeSession: { type: DmSessionSchema },
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
