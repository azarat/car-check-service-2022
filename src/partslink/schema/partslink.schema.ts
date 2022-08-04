import { Document, Schema, model } from 'mongoose';

import { StatusEnum } from '../enums/status.enum';

export interface PartslinkDocument extends Document {
  user: string;
  status: StatusEnum;
  report?: string;
  userAgent?: string;
  vin: string;
  brand: string;
  createdAt: Date;
  payedAt: Date;
}

export const PartslinkSchema = new Schema(
  {
    user: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(StatusEnum),
      default: StatusEnum.INIT,
      required: true,
    },
    report: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    vin: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    payedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
    },
  },
);

export const PartslinkModel = model<PartslinkDocument>('Partslink-report', PartslinkSchema);
