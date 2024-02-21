import fastify from 'fastify';
import swagger from 'fastify-swagger';
import formbody from 'fastify-formbody';
import fastifyCron from 'fastify-cron';
import mongoose from 'mongoose';

import config from './config/config';
import partslinkController from './partslink/partslink.controller';
import HttpError from './errors/HttpError';
import partslinkService from './partslink/partslink.service';
import carNumberController from './car-number/car-number.controller';
import carfaxController from './carfax/carfax.controller';
import { LanguagesEnum } from './errors/languages.enum';

const app = fastify({
  logger: true,
});

app.get(`/${process.env.API_ENV}/CarCheckService/health`, async () => 'Hello World');
app.register(formbody);
app.register(swagger, {
  exposeRoute: true,
  routePrefix: `/${process.env.API_ENV}/CarCheckService/docs`,
  swagger: {
    host: config.apiHost,
    info: {
      title: 'Cars check service API',
      version: 'v1',
    },
  },
});
app.setErrorHandler((err, req, res) => {
  app.log.error(err);
  const { message } = err;
  if (err instanceof HttpError) {
    const language = req.headers['accept-language'];
    const errorLanguage = Object.keys(LanguagesEnum).includes(language)
      ? language
      : LanguagesEnum.uk;
    const errorMessage = typeof message === 'string' ? message : message[errorLanguage];
    res.status(err.code).send(errorMessage);
  } else {
    res.status(500).send(message);
  }
});
app.register(carfaxController, { prefix: `/${process.env.API_ENV}/CarCheckService/carfax` });
app.register(partslinkController, { prefix: `/${process.env.API_ENV}/CarCheckService/partslink` });
app.register(carNumberController, { prefix: `/${process.env.API_ENV}/CarCheckService/check` });
app.register(fastifyCron, {
  jobs: [
    {
      cronTime: '0 0 * * *',
      onTick: async () => {
        await partslinkService.resetRequests();
      },
    },
  ],
});

const start = async () => {
  try {
    await config.init();
    await mongoose.connect(config.mongoUri);
    await app.listen(config.port, '0.0.0.0');
    app.cron.startAllJobs();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();

export default app;
