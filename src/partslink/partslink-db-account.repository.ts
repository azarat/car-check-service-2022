import { Types } from 'mongoose';

import { PartslinkAccountDocument, PartslinkAccountModel } from './schema/partslink-account.schema';

export class PartslinkDbAccountRepository {
  async getAccount(): Promise<PartslinkAccountDocument> {
    const [account] = await PartslinkAccountModel.find().sort({ requests: 1 }).limit(1);
    return account;
  }

  async incrementRequests(id: string): Promise<void> {
    await PartslinkAccountModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $inc: { requests: 1 } });
  }

  async resetRequests(): Promise<void> {
    await PartslinkAccountModel.updateMany({}, {
      requests: 0,
    });
  }
}

export default new PartslinkDbAccountRepository();
