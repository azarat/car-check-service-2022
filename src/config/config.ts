import dotenv from 'dotenv';
import AWS from 'aws-sdk';

import s3 from '../s3/s3.service';
import { IPartslinkCars } from './interfaces/partslink-car.interface';

dotenv.config();

class Config {
  private static readonly secrets = new AWS.SecretsManager({
    region: process.env.REGION,
  });

  private static readonly getSecret = async (secretName: string) => {
    const { SecretString } = await Config.secrets
      .getSecretValue({
        SecretId: process.env.SECRET_ID,
      })
      .promise();
    const secrets = JSON.parse(SecretString);
    return secrets[secretName];
  };

  port: string;
  apiHost: string;
  mongoUri: string;
  carfaxApiUrl: string;
  carfaxLogin: string;
  carfaxPassword: string;
  userSdkUrl: string;
  userSdkSecret: string;
  carfaxPrice: string;
  partslinkPrice: string;
  partslinkCars: IPartslinkCars;
  s3Bucket: string;
  carfaxS3Folder: string;
  partslinkS3Folder: string;
  partslinkAccountLimit: number;
  pushLambdaSecret: string;
  pushNotificationsUri: string;
  liqpayIosPublicKey: string;
  liqpayAndroidPublicKey: string;
  liqpayIosPrivateKey: string;
  liqpayAndroidPrivateKey: string;
  checkCarPlate: string;

  constructor() {
    this.port = process.env.PORT;
    this.apiHost = process.env.API_HOST;
    this.userSdkUrl = process.env.USER_SDK_URL;
    this.s3Bucket = process.env.S3_BUCKET;
    this.carfaxS3Folder = process.env.CARFAX_S3_FOLDER;
    this.partslinkS3Folder = process.env.PARTSLINK_S3_FOLDER;
    this.partslinkAccountLimit = +process.env.PARTSLINK_ACCOUNT_LIMIT;
  }

  async init() {
    const carfaxSettings = await s3.getJsonFile(process.env.CARFAX_SETTINGS);
    const partslinkSettings = await s3.getJsonFile(process.env.PARTSLINK_SETTINGS);
    this.mongoUri = await Config.getSecret('MONGO_URI');
    this.carfaxLogin = await Config.getSecret('CARFAX_LOGIN');
    this.carfaxPassword = await Config.getSecret('CARFAX_PASSWORD');
    this.userSdkSecret = await Config.getSecret('USER_SDK_SECRET');
    this.carfaxApiUrl = await Config.getSecret('CARFAX_API_URL');
    this.pushLambdaSecret = await Config.getSecret('PUSH_LAMBDA_SECRET');
    this.pushNotificationsUri = await Config.getSecret('PUSH_NOTIFICATIONS_URI');
    this.liqpayIosPublicKey = await Config.getSecret('LIQPAY_IOS_PUBLIC_KEY');
    this.liqpayAndroidPublicKey = await Config.getSecret('LIQPAY_ANDROID_PUBLIC_KEY');
    this.liqpayIosPrivateKey = await Config.getSecret('LIQPAY_IOS_PRIVATE_KEY');
    this.liqpayAndroidPrivateKey = await Config.getSecret('LIQPAY_ANDROID_PRIVATE_KEY');
    this.checkCarPlate = await Config.getSecret('CHECKCAR_PLATE');
    this.carfaxPrice = carfaxSettings.price;
    this.partslinkPrice = partslinkSettings.price;
    this.partslinkCars = partslinkSettings.cars;
  }
}

export default new Config();
