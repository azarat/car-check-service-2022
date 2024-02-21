import axios from 'axios';
import Payment from '@day-drive/liqpay-sdk/lib/cjs';
import { CallbackDto } from '@day-drive/liqpay-sdk/lib/cjs/types';
import { verifyUser, getUserById } from '@day-drive/user-sdk/lib/cjs';

import carfaxDbRepository from './carfax-db.repository';
import { StatusEnum } from './enums/status.enum';
import carfaxRepository from './carfax.repository';
import { InitReportDto } from './dto/init-report.dto';
import s3 from '../s3/s3.service';
import config from '../config/config';
import HttpError from '../errors/HttpError';
import { ReportInfoDto } from './dto/report-info.dto';
import { getKeys } from '../user-agent';
import { generatePdf } from 'html-pdf-node';
import crypto from "crypto"
import url from 'url'

class CarfaxService {
  private static NOTIFICATION_TYPE = 'CARFAX_PAYED';

  async initReport(
    { vin }: InitReportDto,
    token: string,
    userAgent: string,
    acceptLanguage: string,
  ): Promise<string> {
    const language = acceptLanguage || 'uk';
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
    // const userId = '62f3995f8283787f4b4a1231'

    // if (await carfaxRepository.getRequestCount() <= 0) {
    //   throw new HttpError(503, 'Carfax quota is exceeded');
    // }

    if (await carfaxDbRepository.existsByUserAndVin(userId, vin)) {
      throw new HttpError(409, HttpError.REPORT_EXIST);
    }

    const { publicKey, privateKey } = getKeys(userAgent);
    const { id } = await carfaxDbRepository.createRecord(userId, vin, userAgent);

    const fileName = `${config.carfaxS3Folder}/${vin}.pdf`;

    const hasReport = await carfaxRepository.existsReport(vin, language);
    
    await carfaxDbRepository.updateStatus(id, StatusEnum.IN_PROGRESS);

    const payment = new Payment(
      publicKey,
      id,
      config.carfaxPrice,
      `DayDrive LLC / Carfax / ${vin}`,
      `https://${config.apiHost}/${process.env.API_ENV}/CarCheckService/carfax/callback/${id}`,
    );
    return payment.createPayment(privateKey);
  }

  async savepdf(body: CallbackDto, id: string): Promise<void> {
    console.log(id, "id");
    const { vin } = await carfaxDbRepository.findById(id);
    console.log(vin, "vin");

    const fileName = `${config.carfaxS3Folder}/${vin}_test1.pdf`;
    let options = { format: 'A4' };

    if (!(await s3.existFile(fileName))) {
      // const { buffer } = await carfaxRepository.bufferReport(vin);
      let file = { url: "https://report.covin.top/api/report/24332a9f35514b7da2297aa8fc633bc3" };

      generatePdf(file, options, async (err, buffer) => {
        console.log("ok1");
        await s3.uploadFile(buffer, fileName);
        console.log("ok2");
      });
    }
  }

  async checkReport(id: string): Promise<void> {
    const {
      user, vin, status: reportStatus, userAgent,
    } = await carfaxDbRepository.findById(id);
    const { publicKey, privateKey } = getKeys(userAgent);
    const base64Data = Buffer.from(JSON.stringify({
      public_key: publicKey,
      version: 3,
      action: "status",
      order_id: id
    })).toString('base64');

    const sha1 = crypto.createHash('sha1');
    sha1.update(privateKey + base64Data + privateKey);
    const signature = sha1.digest('base64');

    const dataToCheck = {
      data: base64Data,
      signature: signature
    }

    const { data: { status } } = await axios.post(
      `https://www.liqpay.ua/api/request`,
      (new url.URLSearchParams(dataToCheck)).toString(),
    )

    try {
      await this.generateReport(reportStatus, id, vin, user, status)      
    } catch (error) {
      throw new HttpError(402, HttpError.INVALID_VIN);      
    }
  }

  async generateReport(reportStatus: StatusEnum, id: string, vin: string, user: string, status: string): Promise<void> {
    const isSuccess = ['success', 'wait_accept'].includes(status.toLowerCase());
    if (isSuccess && reportStatus === StatusEnum.IN_PROGRESS) {

      const fileName = `${config.carfaxS3Folder}/${vin}.pdf`;

      if (!(await s3.existFile(fileName))) {
        const { name } = await carfaxRepository.createReport(vin);
        let file = { url: name };
  
        let options = { format: 'A4' };
        generatePdf(file, options, async (err, buffer) => {
          await s3.uploadFile(buffer, fileName);
        });
      }
  
      await carfaxDbRepository.updateReport(id, fileName);
      await carfaxDbRepository.updateStatus(id, StatusEnum.CREATED);
  
      await carfaxDbRepository.updateStatus(id, StatusEnum.PAYED);
      // await carfaxRepository.subtractRequestCount('');
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
            vin,
            type: CarfaxService.NOTIFICATION_TYPE,
          },
        },
        {
          headers: {
            token: config.pushLambdaSecret,
          },
        });
      await carfaxDbRepository.updateStatus(id, StatusEnum.DONE);
    }
  }

  async payReport(body: CallbackDto, id: string): Promise<void> {
    const {
      user, vin, status: reportStatus, userAgent,
    } = await carfaxDbRepository.findById(id);
    const { privateKey } = getKeys(userAgent);
    const { status } = Payment.handleCallback(body, privateKey);
    
    this.generateReport(reportStatus, id, vin, user, status)
  }

  async getReports(token: string): Promise<ReportInfoDto[]> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );

    const reports = await carfaxDbRepository.findByUser(userId);
    return reports.map(({ id, vin, createdAt }) => ({
      id,
      vin,
      createdAt: createdAt.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }),
    }));
  }

  async getReport(token: string, id: string): Promise<string> {
    const { id: userId } = await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
    const reportData = await carfaxDbRepository.findByUserAndId(userId, id);

    if (!reportData && ![StatusEnum.PAYED, StatusEnum.DONE].includes(reportData.status)) {
      throw new HttpError(403, HttpError.FORBIDDEN);
    }

    return s3.getSignedUrl(reportData.report);
  }
}

export default new CarfaxService();
