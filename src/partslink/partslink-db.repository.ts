/* eslint-disable no-void */
import { Types } from 'mongoose';

import { StatusEnum } from './enums/status.enum';
import { PartslinkModel, PartslinkDocument } from './schema/partslink.schema';

class PartslinkDbRepository {
  async createRecord(
    user: string, vin: string, brand: string, userAgent: string,
  ): Promise<PartslinkDocument> {
    return PartslinkModel.create({
      user,
      vin,
      brand,
      userAgent,
      createdAt: new Date(),
    });
  }

  async updateStatus(id: string, status: StatusEnum): Promise<void> {
    if (status === StatusEnum.PAYED) {
      return void await PartslinkModel.findByIdAndUpdate(id, {
        payedAt: new Date(),
        status,
      });
    }

    return void await PartslinkModel.findByIdAndUpdate(id, {
      status,
    });
  }

  async updateReport(id: string, report: string): Promise<void> {
    await PartslinkModel.findByIdAndUpdate(id, {
      report,
    });
  }

  async findByUser(user: string): Promise<PartslinkDocument[]> {
    return PartslinkModel.find({
      $or: [
        { user, status: StatusEnum.CREATED },
        { user, status: StatusEnum.PAYED },
        { user, status: StatusEnum.DONE },
      ],
    });
  }

  async findByVin(vin: string): Promise<PartslinkDocument> {
    return PartslinkModel.findOne({ vin }).sort({ createdAt: -1 });
  }

  async findByUserAndVin(user: string, vin: string): Promise<PartslinkDocument> {
    return PartslinkModel.findOne({
      user,
      vin,
    });
  }

  async findByUserAndId(user: string, id: string): Promise<PartslinkDocument> {
    return PartslinkModel.findOne({
      _id: new Types.ObjectId(id),
      user,
    });
  }

  async findById(id: string): Promise<PartslinkDocument> {
    return PartslinkModel.findById(id);
  }
}

export default new PartslinkDbRepository();
