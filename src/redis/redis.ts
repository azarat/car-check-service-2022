import Redis, { Redis as RedisType } from 'ioredis';

class RedisClient {
  static carfaxCookie = 'carfaxCookie';

  client: RedisType;

  constructor() {
    this.client = new Redis(6379, '127.0.0.1');
  }

  async setValue(key: string, value: string, expire: number) {
    await this.client.set(key, value, 'EX', expire);
  }

  async getValue(key: string): Promise<string> {
    return this.client.get(key);
  }
}
export { RedisClient };
export default new RedisClient();
