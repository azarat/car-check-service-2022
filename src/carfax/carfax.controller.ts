import { FastifyInstance } from 'fastify';
import { CallbackDto } from '@day-drive/liqpay-sdk/lib/cjs/types';

import {
  Body, Headers, Params, TokenHeadersDto,
} from '../types';
import carfaxService from './carfax.service';
import { InitReportDto, initReportSchema } from './dto/init-report.dto';
import { GetReportParamsDto, getReportSchema } from '../dto';
import { userGuard } from '../guards/user.guard';

const carfaxController = (server: FastifyInstance, _, done) => {
  server.post<Headers<TokenHeadersDto> & Body<InitReportDto>>('/', {
    schema: initReportSchema,
    // preValidation: userGuard,
    handler: async (req) => {
      const { token } = req.headers;
      return carfaxService.initReport(req.body, token, req.headers['user-agent'], req.headers['accept-language']);
    },
  });

  server.get<Headers<TokenHeadersDto>>('/reports', {
    schema: {
      tags: ['Carfax'],
      description: 'Get all user\'s reports',
      headers: {
        token: { type: 'string' },
      },
    },
    preValidation: userGuard,
    handler: async (req) => carfaxService.getReports(req.headers.token),
  });

  server.get<Headers<TokenHeadersDto> & Params<GetReportParamsDto>>('/reports/:id', {
    preValidation: userGuard,
    schema: {
      ...getReportSchema,
      tags: ['Carfax'],
      description: 'Returns link to a carfax report',
    },
    handler: async (req) => carfaxService.getReport(req.headers.token, req.params.id),
  });

  server.post<Body<CallbackDto> & Params<{ id: string }>>('/callback/:id', {
    schema: { hide: true },
    handler: async (req, res) => {
      await carfaxService.payReport(req.body, req.params.id);
      res.send(200);
    },
  });

  done();
};

export default carfaxController;
