import mongoose, { Document, Schema } from "mongoose";

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  userId: string;
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: WhiteboardPoint[];
  createdAt: Date;
}

export interface IWhiteboard extends Document {
  roomId: string;
  kind: "dm";
  strokes: WhiteboardStroke[];
  updatedAt: Date;
  createdAt: Date;
}

const PointSchema = new Schema<WhiteboardPoint>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false }
);

const StrokeSchema = new Schema<WhiteboardStroke>(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    tool: { type: String, enum: ["pen", "eraser"], required: true },
    color: { type: String, required: true },
    size: { type: Number, required: true, min: 1, max: 80 },
    points: { type: [PointSchema], default: [] },
    createdAt: { type: Date, default: Date.now, required: true },
  },
  { _id: false }
);

const WhiteboardSchema = new Schema<IWhiteboard>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ["dm"], default: "dm", required: true },
    strokes: { type: [StrokeSchema], default: [] },
  },
  { timestamps: true }
);

export const Whiteboard = mongoose.model<IWhiteboard>("Whiteboard", WhiteboardSchema);
