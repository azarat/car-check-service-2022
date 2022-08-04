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

    if (await carfaxRepository.getRequestCount() <= 0) {
      throw new HttpError(503, 'Carfax quota is exceeded');
    }

    if (await carfaxDbRepository.existsByUserAndVin(userId, vin)) {
      throw new HttpError(409, HttpError.REPORT_EXIST);
    }

    const { publicKey, privateKey } = getKeys(userAgent);
    const { id } = await carfaxDbRepository.createRecord(userId, vin, userAgent);
    const fileName = `${config.carfaxS3Folder}/${vin}.pdf`;
    if (!(await s3.existFile(fileName))) {
      await carfaxDbRepository.updateStatus(id, StatusEnum.IN_PROGRESS);
      const { buffer } = await carfaxRepository.createReport(vin, language);
      await s3.uploadFile(buffer, fileName);
    }
    await carfaxDbRepository.updateReport(id, fileName);
    await carfaxDbRepository.updateStatus(id, StatusEnum.CREATED);
    const payment = new Payment(
      publicKey,
      id,
      config.carfaxPrice,
      'DayDrive LLC',
      `https://${config.apiHost}/carfax/callback/${id}`,
    );
    return payment.createPayment(privateKey);
  }

  async payReport(body: CallbackDto, id: string): Promise<void> {
    const {
      user, vin, status: reportStatus, userAgent,
    } = await carfaxDbRepository.findById(id);
    const { privateKey } = getKeys(userAgent);
    const { status } = Payment.handleCallback(body, privateKey);
    const isSuccess = ['success', 'wait_accept'].includes(status.toLowerCase());
    if (isSuccess && reportStatus === StatusEnum.CREATED) {
      await carfaxDbRepository.updateStatus(id, StatusEnum.PAYED);
      await carfaxRepository.subtractRequestCount('');
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
