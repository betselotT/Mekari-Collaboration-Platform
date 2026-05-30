import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICertificateEvent extends Document {
  userId: Types.ObjectId;
  certificateId: string;
  title: string;
  description: string;
  milestone: string;
  refId?: string;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateEventSchema = new Schema<ICertificateEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    certificateId: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    milestone: { type: String, required: true },
    refId: { type: String },
    issuedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

CertificateEventSchema.index({ userId: 1, certificateId: 1 }, { unique: true });
CertificateEventSchema.index({ userId: 1, issuedAt: -1 });
CertificateEventSchema.index({ certificateId: 1, issuedAt: -1 });

export const CertificateEvent = mongoose.model<ICertificateEvent>(
  "CertificateEvent",
  CertificateEventSchema
);
