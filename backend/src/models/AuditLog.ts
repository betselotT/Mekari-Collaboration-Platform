import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAuditLog extends Document {
  actorId?: Types.ObjectId;
  actorName?: string;
  actorEmail?: string;
  actionType: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String },
    actorEmail: { type: String },
    actionType: { type: String, required: true, index: true },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    status: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
