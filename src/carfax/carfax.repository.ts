/* eslint-disable no-empty-function */
/* eslint-disable no-useless-constructor */
/* eslint-disable consistent-return */
/* eslint-disable max-classes-per-file */
import axios, { AxiosInstance } from 'axios';

import config from '../config/config';
// import redisClient, { RedisClient } from '../redis/redis';
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

  async existsReport(vin: string, language: string): Promise<any> {
    try {
      const {
        data: {
          Records
        }
      } = await HttpClient.httpClient.get(`/report-check?vin=${vin}&token=${config.carfaxToken}`);

      if (Records == null)
        throw new HttpError(404, HttpError.VIN_NOT_FOUND);
    } catch {
      throw new HttpError(422, HttpError.INVALID_VIN);
    }

    return true
  }

  async createReport(vin: string): Promise<IReport> {
    // const cookie = this.getCookies();
    // const date = new Date().getTime();
    // const params = new URLSearchParams();
    // params.append('id', vin);
    // params.append('date', `${date}`);
    // params.append('lang', language);

    // Check if Carfax exists
    try {
      console.log(config.carfaxToken, "carfaxToken");
      console.log(vin, "vin");
      
      const {
        data: {
          Records
        }
      } = await HttpClient.httpClient.get(`/report-check?vin=${vin}&token=${config.carfaxToken}`);

      if (Records == null)
        throw new HttpError(422, HttpError.INVALID_VIN);
    } catch {
      throw new HttpError(422, HttpError.INVALID_VIN);
    }

    // Buy Carfax
    const { 
      data: {
        status,
        file
      }
    } = await HttpClient.httpClient.post(
      `report?token=${config.carfaxToken}`,
      {
        source_group: "carfax",
        vin,
      }
    );

    if (status !== "Success")
      throw new HttpError(422, HttpError.INVALID_VIN);
    
    // Download Carfax
    const {
      data: buffer,
    } = await HttpClient.httpClient.get(
      file,
      { responseType: 'arraybuffer' },
    );

    return {
      name: file,
      buffer,
    };
  }

  // async getRequestCount(): Promise<number> {
  //   const params = new URLSearchParams();
  //   params.append('action', 'GetUsers');
  //   params.append('data[login_hash]', await this.getToken());

  //   const { data: { data } } = await HttpClient.httpClient.post('/api/', params, {
  //     headers: {
  //       'Content-type': CarfaxRepository.contentType,
  //     },
  //   });

  //   return +data[0].value;
  // }

  // async getToken(): Promise<string | undefined> {
  //   const cookies = await this.getCookies();
  //   const value = `; ${cookies[0]}`;
  //   const parts = value.split('; login=');
  //   if (parts.length === 2) { return parts.pop().split(';').shift(); }
  // }

  // async subtractRequestCount(report: string): Promise<void> {
  //   const cookie = await this.getCookies();
  //   const params = new URLSearchParams();
  //   params.append('action', 'AddFunds');
  //   params.append('data[login_hash]', await this.getToken());
  //   params.append('data[value]', '-1');
  //   params.append('data[description]', report);
  //   await HttpClient.httpClient.post('/api/', params, {
  //     headers: {
  //       'Content-type': CarfaxRepository.contentType,
  //       cookie,
  //     },
  //   });
  // }

  // private async getCookies(): Promise<string[]> {
  //   // const cookies = await redisClient.getValue(RedisClient.carfaxCookie);
  //   // if (cookies) {
  //   //   return [cookies];
  //   // }
  //   const params = new URLSearchParams();
  //   params.append('action', 'Login');
  //   params.append('data[login]', config.carfaxLogin);
  //   params.append('data[password]', config.carfaxPassword);
  //   console.log(config.carfaxLogin, config.carfaxPassword, '==========');
  //   const res = await HttpClient.httpClient.post('/api/', params, {
  //     headers: {
  //       'Content-type': CarfaxRepository.contentType,
  //     },
  //   });

  //   // await redisClient.setValue(RedisClient.carfaxCookie, res.headers['set-cookie'][0], CarfaxRepository.cookieExpiration);

  //   return res.headers['set-cookie'];
  // }
}

export default new CarfaxRepository();
