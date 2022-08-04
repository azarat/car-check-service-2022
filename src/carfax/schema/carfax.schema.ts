import { Document, Schema, model } from 'mongoose';
import { StatusEnum } from '../enums/status.enum';

export interface CarfaxDocument extends Document {
  user: string;
  status: StatusEnum;
  report?: string;
  userAgent?: string;
  vin: string;
  createdAt: Date,
}

export const CarfaxSchema = new Schema(
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
    createdAt: {
      type: Date,
    },
  },
);

export const CarfaxModel = model<CarfaxDocument>('Carfax-report', CarfaxSchema);
