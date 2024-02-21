import AWS from 'aws-sdk';

import config from '../config/config';

class S3 {
  private readonly s3: AWS.S3;
  constructor() {
    // this.s3 = new AWS.S3({ region: 'eu-central-1' });
    this.s3 = new AWS.S3({
      endpoint: config.digiSpaceEndpoint,
      accessKeyId: config.digiSpaceAccessKeyId,
      secretAccessKey: config.digiSpaceSecretAccessKey,
    });
  }

  async uploadFile(buffer: Buffer, name: string): Promise<string> {
    const { Key } = await this.s3
      .upload({
        Bucket: config.s3Bucket,
        Key: name,
        Body: buffer,
      })
      .promise();
    return Key;
  }

  async existFile(name: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: config.s3Bucket,
          Key: name,
        })
        .promise();
      return true;
    } catch {
      return false;
    }
  }

  async getJsonFile(name: string): Promise<any> {
    const { Body } = await this.s3.getObject({
      Bucket: config.s3Bucket,
      Key: name,
    }).promise();
    return JSON.parse(Body.toString('utf8'));
  }

  getSignedUrl(filename: string): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: config.s3Bucket,
      Key: filename,
      Expires: 10 * 60,
    });
  }
}

export default new S3();
