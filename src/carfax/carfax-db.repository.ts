import { Types } from 'mongoose';

import { CarfaxModel, CarfaxDocument } from './schema/carfax.schema';
import { StatusEnum } from './enums/status.enum';

class CarfaxDbRepository {
  async createRecord(user: string, vin: string, userAgent: string): Promise<CarfaxDocument> {
    return CarfaxModel.create({
      user,
      vin,
      userAgent,
      createdAt: new Date(),
    });
  }

  async findById(id: string): Promise<CarfaxDocument> {
    return CarfaxModel.findById(id);
  }

  async updateStatus(id: string, status: StatusEnum): Promise<void> {
    await CarfaxModel.findByIdAndUpdate(id, {
      status,
    });
  }

  async updateReport(id: string, report: string): Promise<void> {
    await CarfaxModel.findByIdAndUpdate(id, {
      report,
    });
  }

  async findByUser(user: string): Promise<CarfaxDocument[]> {
    return CarfaxModel.find({
      $or: [
        { user, status: StatusEnum.DONE },
        { user, status: StatusEnum.PAYED },
      ],
    }).sort({ createdAt: -1 });
  }

  async findByUserAndId(user: string, id: string): Promise<CarfaxDocument> {
    return CarfaxModel.findOne({
      _id: new Types.ObjectId(id),
      user,
    });
  }

  async existsByUserAndVin(user: string, vin: string): Promise<boolean> {
    const report = await CarfaxModel.findOne({
      user,
      vin,
    });

    return report && [StatusEnum.PAYED, StatusEnum.DONE].includes(report.status);
  }
}

export default new CarfaxDbRepository();
