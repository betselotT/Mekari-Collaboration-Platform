import mongoose, { Document, Schema, Types } from "mongoose";

export interface IKnowledgeDoc extends Document {
  questionId: Types.ObjectId;
  title: string;
  tags: string[];
  body: string;
  aiResponse?: Record<string, unknown>;
  solution: string;
  threadSummary: string;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeDocSchema = new Schema<IKnowledgeDoc>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Thread", required: true, index: true },
    title: { type: String, required: true },
    tags: { type: [String], default: [], index: true },
    body: { type: String, default: "" },
    aiResponse: { type: Schema.Types.Mixed },
    solution: { type: String, default: "" },
    threadSummary: { type: String, default: "" },
  },
  { timestamps: true }
);

export const KnowledgeDoc = mongoose.model<IKnowledgeDoc>("KnowledgeDoc", KnowledgeDocSchema);
