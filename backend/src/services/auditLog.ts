import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog";

export async function logAuditEvent(params: {
  actorId?: string | Types.ObjectId;
  actorName?: string;
  actorEmail?: string;
  actionType: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await AuditLog.create({
      ...params,
      actorId: params.actorId ? new Types.ObjectId(String(params.actorId)) : undefined,
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
