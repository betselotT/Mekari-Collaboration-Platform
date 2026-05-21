import { z } from "zod";
import { Whiteboard } from "../models/Whiteboard";
import { userCanAccessDm } from "./dmMessages";

export const whiteboardStrokeSchema = z.object({
  id: z.string().min(1).max(120),
  roomId: z.string().min(1).max(120),
  tool: z.enum(["pen", "eraser"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().min(1).max(80),
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      })
    )
    .min(1)
    .max(1200),
});

export const whiteboardClearSchema = z.object({
  roomId: z.string().min(1).max(120),
});

export function whiteboardRoomName(roomId: string) {
  return `whiteboard:${roomId}`;
}

function conversationIdFromRoom(roomId: string) {
  return roomId.startsWith("dm:") ? roomId.slice(3) : "";
}

export async function userCanAccessWhiteboard(roomId: string, userId?: string) {
  const conversationId = conversationIdFromRoom(roomId);
  if (!conversationId) return false;
  return userCanAccessDm(conversationId, userId);
}

export async function getWhiteboard(roomId: string, userId: string) {
  if (!(await userCanAccessWhiteboard(roomId, userId))) {
    const error = new Error("You do not have access to this whiteboard") as Error & {
      status?: number;
    };
    error.status = 403;
    throw error;
  }

  const board = await Whiteboard.findOneAndUpdate(
    { roomId },
    { $setOnInsert: { roomId, kind: "dm", strokes: [] } },
    { new: true, upsert: true }
  ).lean();

  return {
    roomId,
    strokes: board?.strokes || [],
  };
}

export async function addWhiteboardStroke(input: z.infer<typeof whiteboardStrokeSchema>, userId: string) {
  if (!(await userCanAccessWhiteboard(input.roomId, userId))) return null;

  const stroke = {
    id: input.id,
    userId,
    tool: input.tool,
    color: input.color,
    size: input.size,
    points: input.points,
    createdAt: new Date(),
  };

  await Whiteboard.findOneAndUpdate(
    { roomId: input.roomId },
    {
      $setOnInsert: { roomId: input.roomId, kind: "dm" },
      $push: { strokes: stroke },
    },
    { upsert: true, new: true }
  );

  return stroke;
}

export async function clearWhiteboard(roomId: string, userId: string) {
  if (!(await userCanAccessWhiteboard(roomId, userId))) return false;
  await Whiteboard.findOneAndUpdate(
    { roomId },
    { $setOnInsert: { roomId, kind: "dm" }, $set: { strokes: [] } },
    { upsert: true }
  );
  return true;
}

export async function undoWhiteboardStroke(roomId: string, strokeId: string, userId: string) {
  if (!(await userCanAccessWhiteboard(roomId, userId))) return false;
  await Whiteboard.findOneAndUpdate(
    { roomId },
    { $pull: { strokes: { id: strokeId, userId } } }
  );
  return true;
}
