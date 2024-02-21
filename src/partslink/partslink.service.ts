/* eslint-disable indent */
/* eslint-disable consistent-return */
/* eslint-disable array-callback-return */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import axios from 'axios';
import htmlToPdf from 'html-pdf-node';
import Payment from '@day-drive/liqpay-sdk/lib/cjs';
import { verifyUser, getUserById } from '@day-drive/user-sdk/lib/cjs';
import { CallbackDto } from '@day-drive/liqpay-sdk/lib/cjs/types';

import partslinkRepository from './partslink.repository';
import config from '../config/config';
import { InitReportDto } from './dto/init-report.dto';
import partslinkDbRepository from './partslink-db.repository';
import s3 from '../s3/s3.service';
import { StatusEnum } from './enums/status.enum';
import HttpError from '../errors/HttpError';
import { ReportResponseDto } from './dto/report-response.dto';
import { ReportInfoDto } from './dto/report-info.dto';
import partslinkDbAccountRepository from './partslink-db-account.repository';
import { getKeys } from '../user-agent';

class PartslinkService {
  private static NOTIFICATION_TYPE = 'PARTSLINK_PAYED';

  getCars(): string[] {
    return Object.keys(config.partslinkCars).sort();
  }

  async initReport(
    token: string, { vin, brand }: InitReportDto, userAgent: string,
  ): Promise<ReportResponseDto> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
    const carBrand = brand.toLowerCase();
    const { publicKey, privateKey } = getKeys(userAgent);
    const reportDocument = await partslinkDbRepository.findByVin(vin);

    if (reportDocument && reportDocument.brand !== brand) {
      throw new HttpError(422, HttpError.INVALID_VIN);
    }

    const id = await this.getUserReportId(userId, vin, carBrand, userAgent);
    const car = config.partslinkCars[carBrand];

    const fileName = `${config.partslinkS3Folder}/${vin}.json`;
    if (!(await s3.existFile(fileName))) {
      await partslinkDbRepository.updateStatus(id, StatusEnum.IN_PROGRESS);
      const data = await partslinkRepository.getCar(car, vin);
      const buffer = Buffer.from(data);
      await s3.uploadFile(buffer, fileName);
    }

    await partslinkDbRepository.updateReport(id, fileName);
    await partslinkDbRepository.updateStatus(id, StatusEnum.CREATED);
    const payment = new Payment(
      publicKey,
      id,
      config.partslinkPrice,
      'DayDrive LLC',
      `https://${config.apiHost}/${process.env.API_ENV}/CarCheckService/partslink/callback/${id}`,
    );
    const paymentLink = payment.createPayment(privateKey);
    return {
      id,
      brand: carBrand,
      reportType: car.type,
      vin,
      data: await s3.getJsonFile(fileName),
      paymentLink,
      status: StatusEnum.CREATED,
    };
  }

  async getReports(token: string): Promise<ReportInfoDto[]> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );

    const reports = await partslinkDbRepository.findByUser(userId);

    const reportsInfo: ReportInfoDto[] = [];

    for (const {
      id, vin, payedAt, createdAt, report, brand, status,
    } of reports) {
      reportsInfo.push({
        id,
        vin,
        brand,
        status,
        date: payedAt?.toLocaleString('en-US', { timeZone: 'Europe/Kiev' })
          || createdAt?.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }),
        data: await s3.getJsonFile(report),
      });
    }

    return reportsInfo.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getReport(token: string, id: string, userAgent: string): Promise<ReportResponseDto> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
    const reportData = await partslinkDbRepository.findByUserAndId(userId, id);

    if (!reportData) {
      throw new HttpError(403, HttpError.FORBIDDEN);
    }

    const car = config.partslinkCars[reportData.brand];
    const data = {
      id,
      brand: reportData.brand,
      reportType: car.type,
      vin: reportData.vin,
      data: await s3.getJsonFile(reportData.report),
      status: reportData.status,
    };
    const { publicKey, privateKey } = getKeys(userAgent);
    if (![StatusEnum.PAYED, StatusEnum.DONE].includes(reportData.status)) {
      const payment = new Payment(
        publicKey,
        id,
        config.partslinkPrice,
        'DayDrive LLC',
        `https://${config.apiHost}/${process.env.API_ENV}/CarCheckService/partslink/callback/${id}`,
      );
      const paymentLink = payment.createPayment(privateKey);
      return { ...data, paymentLink };
    }

    return data;
  }

  async getReportPaymentLink(
    token: string,
    id: string,
    userAgent: string,
  ): Promise<string> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
    const reportData = await partslinkDbRepository.findByUserAndId(userId, id);

    if (!reportData) {
      throw new HttpError(403, HttpError.FORBIDDEN);
    }

    const { publicKey, privateKey } = getKeys(userAgent);
    if (![StatusEnum.PAYED, StatusEnum.DONE].includes(reportData.status)) {
      await partslinkDbRepository.updateStatus(id, StatusEnum.WAITING_FOR_PAY);

      const payment = new Payment(
        publicKey,
        id,
        config.partslinkPrice,
        'DayDrive LLC',
        `https://${config.apiHost}/${process.env.API_ENV}/CarCheckService/partslink/callback/${id}`,
      );
      return payment.createPayment(privateKey);
    }

    throw new HttpError(403, HttpError.REPORT_IS_ALREADY_PAYED);
  }

  async payReport(body: CallbackDto, id: string): Promise<void> {
    const {
      user, vin, status: reportStatus, userAgent,
    } = await partslinkDbRepository.findById(id);
    const { privateKey } = getKeys(userAgent);
    const { status } = Payment.handleCallback(body, privateKey);
    const isSuccess = ['success', 'wait_accept'].includes(status.toLowerCase());
    if (isSuccess && reportStatus === StatusEnum.CREATED) {
      await partslinkDbRepository.updateStatus(id, StatusEnum.PAYED);
      const { deviceToken } = await getUserById(
        config.userSdkUrl,
        config.userSdkSecret,
        user,
      );
      await axios.post(config.pushNotificationsUri,
        {
          tokens: deviceToken,
          notification: {
            title: 'Статус отчета изменен',
            body: `Вы успешно оплалили отчет ${vin}`,
          },
          data: {
            id,
            type: PartslinkService.NOTIFICATION_TYPE,
          },
        },
        {
          headers: {
            token: config.pushLambdaSecret,
          },
        });
      await partslinkDbRepository.updateStatus(id, StatusEnum.DONE);
    }
  }

  async resetRequests(): Promise<void> {
    await partslinkDbAccountRepository.resetRequests();
  }

  async generatePdf(token: string, id: string): Promise<string> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
    const { vin, brand, status } = await partslinkDbRepository.findByUserAndId(userId, id);
    if (![StatusEnum.PAYED, StatusEnum.DONE].includes(status)) throw new HttpError(403, 'You don\'t have access to this report');
    const filename = `${config.partslinkS3Folder}/pdf/${vin}.pdf`;
    const pdfIsExist = await s3.existFile(filename);
    if (pdfIsExist) {
      return s3.getSignedUrl(filename);
    }
    const json = await s3.getJsonFile(`${config.partslinkS3Folder}/${vin}.json`);
    const html = this.generateHtml(json, brand);
    htmlToPdf.generatePdf({ content: html }, { format: 'A4' }, async (err, buffer) => {
      await s3.uploadFile(buffer, filename);
    });
    return s3.getSignedUrl(filename);
  }

  private async getUserReportId(
    userId: string, vin: string, brand: string, userAgent: string,
  ): Promise<string> {
    const report = await partslinkDbRepository.findByUserAndVin(userId, vin);
    if (report) {
      if ([StatusEnum.PAYED, StatusEnum.DONE].includes(report.status)) {
        throw new HttpError(409, HttpError.REPORT_EXIST);
      }

      return report.id;
    }
    const { id } = await partslinkDbRepository.createRecord(userId, vin, brand, userAgent);
    return id;
  }

  private generateHtml(json, brand: string): string {
    const marks = {
      vag: ['volkswagen', 'porsche', 'volkswagen nutzfahrzeuge', 'porsche classic', 'seat', 'skoda', 'audi', 'bentley'],
      bmw: ['bmw', 'bmw classic', 'mini'],
      landRover: ['jaguar', 'land rover'],
    };
    const methods = {
      vag: this.generateTableVolkswagen,
      bmw: this.generateTableBmw,
      landRover: this.generateTableJaguar,
      general: this.generateTableGeneral,
    };
    const type = Object.keys(marks).map((item) => {
      if (marks[item].includes(brand)) {
        return item;
      }
    }).filter((item) => item);
    const key = type.length ? type[0] : 'general';
    const html = methods[key].call(this, json);
    const logo = `
      <svg width="80" height="108" viewBox="0 0 191 228" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M88.9884 0H3V76.141L54.5227 60.8425V41.1478H87.0541C95.3188 41.1478 102.88 42.5546 109.562 45.0164C112.728 45.8957 116.244 47.83 119.761 50.2918C120.113 50.4676 120.289 50.6435 120.641 50.9952C123.806 53.2812 126.443 55.9188 128.905 58.9082H128.729C130.136 60.6667 131.543 62.601 132.598 64.5353C132.774 64.887 132.95 65.2387 133.126 65.4145C136.467 71.3933 138.753 78.2512 138.577 85.6367C138.753 87.3952 138.753 88.9778 138.753 90.9121C138.753 120.278 120.465 138.39 92.857 140.676L58.743 182H88.9884C149.303 182 190.627 146.831 190.627 91.0879C190.627 35.1691 149.303 0 88.9884 0Z" fill="#27C9CF"/>
      <path d="M119.586 50.2917L54.5227 81.2405L3 105.683V76.141L54.5227 60.8424L109.562 45.0164C112.552 45.8956 116.069 47.8299 119.586 50.2917Z" fill="#686D76"/>
      <path d="M132.422 64.7111L54.5227 124.147L3 163.36V125.378L54.5227 98.1217L128.554 58.9082C129.96 60.8425 131.191 62.7768 132.422 64.7111Z" fill="#686D76"/>
      <path d="M138.401 85.8126L92.681 140.676L58.567 182H13.3747L61.0288 140.852L136.818 75.4377C135.939 71.9208 134.532 68.5797 132.95 65.5903C136.291 71.7449 138.401 78.6029 138.401 85.8126Z" fill="#686D76"/>
      <path d="M54.3469 41.1477H3V57.6772L54.3469 50.4675V41.1477Z" fill="#2BA6AB"/>
      <path d="M132.422 64.7111L103.935 86.3401C102.177 82.6473 100.067 78.9546 97.2533 75.4377L128.554 58.9082C129.961 60.8425 131.191 62.7768 132.422 64.7111Z" fill="#373A40"/>
      <path d="M119.585 50.2918L87.2299 65.5903C82.658 61.8976 77.2068 58.7323 70.7005 55.9188L109.386 44.8406C112.552 45.8956 116.069 47.83 119.585 50.2918Z" fill="#373A40"/>
      <path d="M107.98 122.564C109.386 115.706 109.738 107.969 108.331 100.232L136.818 75.6135C135.939 72.0966 134.532 68.7555 132.95 65.7661C136.291 71.7449 138.577 78.6028 138.401 85.9883L107.98 122.564Z" fill="#373A40"/>
      <path d="M2.77297 200.5V225H7.00797V200.5H2.77297ZM10.683 225C13.1796 225 15.373 224.498 17.263 223.495C19.153 222.468 20.623 221.045 21.673 219.225C22.7463 217.382 23.283 215.223 23.283 212.75C23.283 210.277 22.7463 208.13 21.673 206.31C20.623 204.467 19.153 203.043 17.263 202.04C15.373 201.013 13.1796 200.5 10.683 200.5H5.32797V204.385H10.578C11.7913 204.385 12.9113 204.56 13.938 204.91C14.9646 205.26 15.8513 205.785 16.598 206.485C17.368 207.185 17.963 208.06 18.383 209.11C18.8263 210.16 19.048 211.373 19.048 212.75C19.048 214.127 18.8263 215.34 18.383 216.39C17.963 217.44 17.368 218.315 16.598 219.015C15.8513 219.692 14.9646 220.217 13.938 220.59C12.9113 220.94 11.7913 221.115 10.578 221.115H5.32797V225H10.683ZM32.004 218.7H44.954L44.184 215.2H32.809L32.004 218.7ZM38.409 207.43L42.329 216.53L42.399 217.545L45.724 225H50.414L38.409 199.135L26.439 225H31.094L34.489 217.335L34.559 216.425L38.409 207.43ZM65.9931 200.5L60.2881 210.965L54.6181 200.5H49.8931L58.2231 214.71V225H62.4231V214.675L70.7181 200.5H65.9931ZM87.5318 200.5V225H91.7668V200.5H87.5318ZM95.4418 225C97.9384 225 100.132 224.498 102.022 223.495C103.912 222.468 105.382 221.045 106.432 219.225C107.505 217.382 108.042 215.223 108.042 212.75C108.042 210.277 107.505 208.13 106.432 206.31C105.382 204.467 103.912 203.043 102.022 202.04C100.132 201.013 97.9384 200.5 95.4418 200.5H90.0868V204.385H95.3368C96.5501 204.385 97.6701 204.56 98.6968 204.91C99.7234 205.26 100.61 205.785 101.357 206.485C102.127 207.185 102.722 208.06 103.142 209.11C103.585 210.16 103.807 211.373 103.807 212.75C103.807 214.127 103.585 215.34 103.142 216.39C102.722 217.44 102.127 218.315 101.357 219.015C100.61 219.692 99.7234 220.217 98.6968 220.59C97.6701 220.94 96.5501 221.115 95.3368 221.115H90.0868V225H95.4418ZM118.898 213.31L126.668 225H131.673L123.343 213.31H118.898ZM113.823 200.5V225H117.953V200.5H113.823ZM116.273 204.07H121.208C122.164 204.07 122.993 204.233 123.693 204.56C124.393 204.887 124.941 205.353 125.338 205.96C125.734 206.567 125.933 207.313 125.933 208.2C125.933 209.063 125.734 209.81 125.338 210.44C124.941 211.047 124.393 211.513 123.693 211.84C122.993 212.143 122.164 212.295 121.208 212.295H116.273V215.725H121.383C123.179 215.725 124.731 215.41 126.038 214.78C127.344 214.15 128.359 213.263 129.083 212.12C129.829 210.977 130.203 209.635 130.203 208.095C130.203 206.555 129.829 205.225 129.083 204.105C128.359 202.962 127.344 202.075 126.038 201.445C124.731 200.815 123.179 200.5 121.383 200.5H116.273V204.07ZM136.388 200.5V225H140.588V200.5H136.388ZM157.122 217.72L149.912 200.5H145.152L157.122 226.365L169.127 200.5H164.332L157.122 217.72ZM176.247 225H188.602V221.36H176.247V225ZM176.247 204.14H188.602V200.5H176.247V204.14ZM176.247 213.66H187.902V210.09H176.247V213.66ZM173.692 200.5V225H177.752V200.5H173.692Z" fill="#373A40"/>
      </svg></br></br>
    `;
    return `${logo}<table style="border-collapse: collapse;" cellpadding="5">${html}</table>`;
  }

  private generateTableGeneral(json): string {
    const {
      vinTabsGeneral,
      vinTabsOptions,
      vinTabsVariDesign,
      vinStandardEquipment,
      vinOptionalEquipment,
    } = json;
    const html = (vinTabsGeneral ? vinTabsGeneral.map(({ title, data }) => {
      if (!title || !data) return '';
      return `<tr>
            <td style="border-bottom: 1px solid black;">${title}</td>
            <td style="border-bottom: 1px solid black;">${data}</td>
          </tr>`;
    }).join(' ') : '')
      + (vinTabsOptions ? vinTabsOptions.map(({ Equipment, Description }) => {
        if (!Equipment || !Description) return '';
        return `<tr>
              <td style="border-bottom: 1px solid black;">${Equipment}</td>
              <td style="border-bottom: 1px solid black;">${Description}</td>
            </tr>`;
      }).join(' ') : '')
      + (vinTabsVariDesign ? vinTabsVariDesign.map(({ Equipment, Description }) => {
        if (!Equipment || !Description) return '';
        return `<tr>
              <td style="border-bottom: 1px solid black;">${Equipment}</td>
              <td style="border-bottom: 1px solid black;">${Description}</td>
            </tr>`;
      }).join(' ') : '')
      + (vinStandardEquipment ? vinStandardEquipment.map(({ Attribute, Description }) => {
        if (!Attribute || !Description) return '';
        return `<tr>
              <td style="border-bottom: 1px solid black;">${Attribute}</td>
              <td style="border-bottom: 1px solid black;">${Description}</td>
            </tr>`;
      }).join(' ') : '')
      + (vinOptionalEquipment ? vinOptionalEquipment.map(({ Attribute, Description }) => {
        if (!Attribute || !Description) return '';
        return `<tr>
              <td style="border-bottom: 1px solid black;">${Attribute}</td>
              <td style="border-bottom: 1px solid black;">${Description}</td>
            </tr>`;
      }).join(' ') : '');
    return html;
  }

  private generateTableVolkswagen(json): string {
    const { prNr, vinfoBasic } = json;
    const html = this.generateTr(vinfoBasic) + (
      prNr ? prNr.records.map((item) => {
        const { values: { col1, col2, col3 } } = item;
        if (!col1 || !col2 || !col3) return '';
        return `<tr>
          <td style="border-bottom: 1px solid black;">${col1}</td>
          <td style="border-bottom: 1px solid black;">${col2}</td>
          <td style="border-bottom: 1px solid black;">${col3}</td>
        </tr>`;
      }).join(' ') : ''
    );
    return html;
  }

  private generateTableJaguar(json): string {
    const { vinfoBasic, vinfoEquipment } = json;
    const html = (
      vinfoBasic ? vinfoBasic.records.map((item) => {
        const { values: { name, value } } = item;
        if (!name || !value) return '';
        return `<tr>
          <td style="border-bottom: 1px solid black;">${name}</td>
          <td style="border-bottom: 1px solid black;">${value}</td>
        </tr>`;
      }).join(' ') : ''
    ) + (
        vinfoEquipment ? vinfoEquipment.records.map((item) => {
          const { values: { name, value } } = item;
          if (!name || !value) return '';
          return `<tr>
          <td style="border-bottom: 1px solid black;">${name}</td>
          <td style="border-bottom: 1px solid black;">${value}</td>
        </tr>`;
        }).join(' ') : ''
      );
    return html;
  }

  private generateTableBmw(json): string {
    const {
      vinfoBasic,
      vinfoLiquidCapacities,
      vinfoOptionalEquipment,
      vinfoStandardEquipment,
    } = json;

    const html = this.generateTr(vinfoBasic)
      + (
        vinfoLiquidCapacities ? vinfoLiquidCapacities.records.map((item) => {
          if (!item?.values) return '';
          const { values: { applArea, type, volume } } = item;
          if (!applArea) return '';
          return `<tr>
          <td style="border-bottom: 1px solid black;">${applArea}</td>
          ${type ? `<td style="border-bottom: 1px solid black;">${type}</td>` : ''}
          <td style="border-bottom: 1px solid black;">${volume || ''}</td>
        </tr>`;
        }).join(' ') : ''
      ) + this.generateTr(vinfoOptionalEquipment)
      + this.generateTr(vinfoStandardEquipment);
    return html;
  }

  private generateTr(data): string {
    if (!data) return '';
    return data.records.map((item) => {
      const { values: { description, value } } = item;
      if (!description || !value) return '';
      return `<tr>
        <td style="border-bottom: 1px solid black;">${description || ''}</td>
        <td style="border-bottom: 1px solid black;">${value || ''}</td>
      </tr>`;
    }).join(' ');
  }
}

export default new PartslinkService();
