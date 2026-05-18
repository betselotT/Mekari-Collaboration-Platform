import mongoose, { Document, Schema, Types } from "mongoose";

export type ThreadStatus = "OPEN" | "PENDING_EXPERT" | "AI_RESOLVED" | "SOLVED" | "CLOSED";

export interface AIResponseData {
  explanation: string;
  steps: string[];
  suggestedSolution: string;
  confidence: number;
  resolved: boolean;
}

export interface SimilarProblemData {
  docId: string;
  threadId: string;
  source?: "knowledge" | "thread";
  canOpenThread?: boolean;
  title: string;
  tags: string[];
  solution: string;
  threadSummary: string;
  similarity: number;
  qualityScore: number;
  combinedScore: number;
  reasons: string[];
}

export interface IThread extends Document {
  title: string;
  subject: string;
  body?: string;
  tags: string[];
  createdBy: Types.ObjectId;
  participants: Types.ObjectId[];
  status: ThreadStatus;
  aiResponse?: AIResponseData;
  similarProblems: SimilarProblemData[];
  matchedExperts: Types.ObjectId[];
  solutionMsgId?: Types.ObjectId;
  isSolved: boolean;
  solvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  googleMeetLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIResponseSchema = new Schema<AIResponseData>(
  {
    explanation: { type: String, default: "" },
    steps: { type: [String], default: [] },
    suggestedSolution: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
    resolved: { type: Boolean, default: false },
  },
  { _id: false }
);

const SimilarProblemSchema = new Schema<SimilarProblemData>(
  {
    docId: { type: String, required: true },
    threadId: { type: String, required: true },
    source: { type: String, enum: ["knowledge", "thread"], default: "thread" },
    canOpenThread: { type: Boolean, default: true },
    title: { type: String, required: true },
    tags: { type: [String], default: [] },
    solution: { type: String, default: "" },
    threadSummary: { type: String, default: "" },
    similarity: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0 },
    combinedScore: { type: Number, default: 0 },
    reasons: { type: [String], default: [] },
  },
  { _id: false }
);

const ThreadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true, index: true },
    body: { type: String },
    tags: { type: [String], default: [], index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["OPEN", "PENDING_EXPERT", "AI_RESOLVED", "SOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    aiResponse: { type: AIResponseSchema },
    similarProblems: { type: [SimilarProblemSchema], default: [] },
    matchedExperts: [{ type: Schema.Types.ObjectId, ref: "User" }],
    solutionMsgId: { type: Schema.Types.ObjectId, ref: "Message" },
    isSolved: { type: Boolean, default: false },
    solvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    googleMeetLink: { type: String },
  },
  { timestamps: true }
);

export const Thread = mongoose.model<IThread>("Thread", ThreadSchema);
