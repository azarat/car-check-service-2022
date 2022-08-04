import axios from 'axios';
import HttpError from '../errors/HttpError';

import { IPartslinkCarSettings } from '../config/interfaces/partslink-car.interface';
import getJsonDataFromHtml from './parcer/parcer';
import partslinkDbAccountRepository from './partslink-db-account.repository';
import config from '../config/config';

const request = axios.create({
  baseURL: 'https://www.partslink24.com',
});

class PartslinkRepository {
  async getCar(car: IPartslinkCarSettings, vin: string): Promise<string> {
    const {
      id, accountLogin, userLogin, password, requests,
    } = await partslinkDbAccountRepository.getAccount();

    if (requests >= config.partslinkAccountLimit) {
      throw new HttpError(503, 'Partslink quota exceeded');
    }

    const cookie = await this.getLoginCookies(accountLogin, userLogin, password);
    const info = {
      json: this.getCarInfo.bind(this),
      html: this.getCarInfoHtml.bind(this),
    };
    await partslinkDbAccountRepository.incrementRequests(id);
    return info[car.type](car, vin, cookie);
  }

  private async getLoginCookies(accountLogin: string, userLogin: string, password: string) {
    const params = new URLSearchParams();
    params.append('loginBean.accountLogin', accountLogin);
    params.append('loginBean.userLogin', userLogin);
    params.append('loginBean.sessionSqueezeOut', 'true');
    params.append('loginBean.password', password);
    params.append('loginBean.userOffsetSec', '10800');
    const loginRes = await request.post(
      '/partslink24/login-ajax!login.action',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      },
    );
    return loginRes.headers['set-cookie'];
  }

  private async getCarInfo(
    { link, serviceName }: IPartslinkCarSettings,
    vin: string,
    cookie: string,
  ): Promise<string> {
    const accessToken = await this.getAccessToken(cookie, serviceName);
    const { data: { data } } = await request.get(link, {
      headers: {
        cookie,
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        lang: 'ru',
        serviceName,
        q: vin,
        p5v: '1.6.7',
        _: Date.now(),
      },
    });
    this.checkIsDataEmpty(data);
    return JSON.stringify(data.segments);
  }

  private async getCarInfoHtml(
    { link }: IPartslinkCarSettings,
    vin: string,
    cookie: string,
  ): Promise<string> {
    const { data } = await request.get(link, {
      headers: {
        cookie,
      },
      params: {
        vin,
        lang: 'en',
      },
    });
    const json = getJsonDataFromHtml(data);
    this.checkIsDataEmpty(json);
    return JSON.stringify(json);
  }

  private async getAccessToken(cookie: string, serviceName: string): Promise<string> {
    const { data } = await request.post(
      '/auth/ext/api/1.1/authorize',
      {
        serviceNames: [serviceName, 'pl24-full-vin-data'],
        withLogin: true,
      },
      {
        headers: {
          cookie,
        },
      },
    );
    return data.access_token;
  }

  private checkIsDataEmpty = (json: any) => {
    if (!Object.keys(json).length) {
      throw new HttpError(422, HttpError.INVALID_VIN);
    }
  }
}

export default new PartslinkRepository();
