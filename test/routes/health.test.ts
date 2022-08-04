import { build } from '../helper';

describe('root tests', () => {
  const app = build();

  test('default root route', async () => {
    const res = await app.inject({
      url: '/health',
    });
    expect(res.payload).toEqual('Hello World');
  });
});
