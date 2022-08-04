/* eslint-disable no-empty-function */
/* eslint-disable no-useless-constructor */
/* eslint-disable consistent-return */
/* eslint-disable max-classes-per-file */
import axios, { AxiosInstance } from 'axios';

import config from '../config/config';
import redisClient, { RedisClient } from '../redis/redis';
import HttpError from '../errors/HttpError';
import { IReport } from './interfaces/report.interface';

class HttpClient {
  private static client: AxiosInstance;

  private constructor() { }

  static get httpClient() {
    if (!HttpClient.client) {
      HttpClient.client = axios.create({
        baseURL: config.carfaxApiUrl,
      });
    }

    return HttpClient.client;
  }
}

class CarfaxRepository {
  private static contentType = 'application/x-www-form-urlencoded';
  private static cookieExpiration = 604800;

  async createReport(vin: string, language: string): Promise<IReport> {
    const cookie = this.getCookies();
    const date = new Date().getTime();
    const params = new URLSearchParams();
    params.append('id', vin);
    params.append('date', `${date}`);
    params.append('lang', language);
    try {
      await HttpClient.httpClient.post('/php/send_to_check.php', params, {
        headers: {
          'Content-type': CarfaxRepository.contentType,
          cookie,
        },
      });
    } catch {
      throw new HttpError(422, HttpError.INVALID_VIN);
    }
    const report = `/carfax/cropped/${vin}-${date}.pdf`;
    const {
      data: buffer,
    } = await HttpClient.httpClient.get(
      report,
      { responseType: 'arraybuffer' },
    );

    return {
      name: report,
      buffer,
    };
  }

  async getRequestCount(): Promise<number> {
    const params = new URLSearchParams();
    params.append('action', 'GetUsers');
    params.append('data[login_hash]', await this.getToken());

    const { data: { data } } = await HttpClient.httpClient.post('/api/', params, {
      headers: {
        'Content-type': CarfaxRepository.contentType,
      },
    });

    return +data[0].value;
  }

  async getToken(): Promise<string | undefined> {
    const cookies = await this.getCookies();
    const value = `; ${cookies[0]}`;
    const parts = value.split('; login=');
    if (parts.length === 2) { return parts.pop().split(';').shift(); }
  }

  async subtractRequestCount(report: string): Promise<void> {
    const cookie = await this.getCookies();
    const params = new URLSearchParams();
    params.append('action', 'AddFunds');
    params.append('data[login_hash]', await this.getToken());
    params.append('data[value]', '-1');
    params.append('data[description]', report);
    await HttpClient.httpClient.post('/api/', params, {
      headers: {
        'Content-type': CarfaxRepository.contentType,
        cookie,
      },
    });
  }

  private async getCookies(): Promise<string[]> {
    const cookies = await redisClient.getValue(RedisClient.carfaxCookie);
    if (cookies) {
      return [cookies];
    }
    const params = new URLSearchParams();
    params.append('action', 'Login');
    params.append('data[login]', config.carfaxLogin);
    params.append('data[password]', config.carfaxPassword);
    console.log(config.carfaxLogin, config.carfaxPassword, '==========');
    const res = await HttpClient.httpClient.post('/api/', params, {
      headers: {
        'Content-type': CarfaxRepository.contentType,
      },
    });

    await redisClient.setValue(RedisClient.carfaxCookie, res.headers['set-cookie'][0], CarfaxRepository.cookieExpiration);

    return res.headers['set-cookie'];
  }
}

export default new CarfaxRepository();
