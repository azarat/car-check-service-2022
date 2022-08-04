import axios from 'axios';

import config from '../config/config';
import HttpError from '../errors/HttpError';

class CarNumberService {
  public async getVinByPlate(licensePlate: string): Promise<string> {
    const { data } = await axios.get(`${config.checkCarPlate}/${encodeURIComponent(licensePlate.replaceAll(' ', ''))}`);
    if (!data.length) throw new HttpError(404, HttpError.VIN_NOT_FOUND);
    const { vin } = data[0];
    if (!vin) throw new HttpError(404, HttpError.VIN_NOT_FOUND);
    return vin;
  }
}

export default new CarNumberService();
