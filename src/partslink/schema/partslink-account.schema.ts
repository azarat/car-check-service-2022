import { Document, Schema, model } from 'mongoose';

export interface PartslinkAccountDocument extends Document {
  accountLogin: string;
  userLogin: string;
  password: string;
  requests: number
}

export const PartslinkAccountSchema = new Schema(
  {
    accountLogin: {
      type: String,
      required: true,
    },
    userLogin: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    requests: {
      type: Number,
      required: true,
    },
  },
);

export const PartslinkAccountModel = model<PartslinkAccountDocument>('Partslink-account', PartslinkAccountSchema);
