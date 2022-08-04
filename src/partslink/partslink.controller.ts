import { FastifyInstance } from 'fastify';
import { CallbackDto } from '@day-drive/liqpay-sdk/lib/types';

import {
  Body, Headers, Params, TokenHeadersDto,
} from '../types';
import { userGuard } from '../guards/user.guard';
import { InitReportDto, initReportSchema } from './dto/init-report.dto';
import partslinkService from './partslink.service';
import { GetReportParamsDto, getReportSchema } from '../dto';

const partslinkController = (server: FastifyInstance, _, done) => {
  server.get('/cars', {
    preValidation: userGuard,
    schema: {
      tags: ['Partslink'],
      description: 'Get all aviable cars',
      headers: {
        token: { type: 'string' },
      },
    },
    handler: async () => partslinkService.getCars(),
  });

  server.post<Headers<TokenHeadersDto> & Body<InitReportDto>>('/', {
    preValidation: userGuard,
    schema: initReportSchema,
    handler: async (req) => partslinkService.initReport(req.headers.token, req.body, req.headers['user-agent']),
  });

  server.get<Headers<TokenHeadersDto>>('/reports', {
    preValidation: userGuard,
    schema: {
      tags: ['Partslink'],
      description: 'Get all user\'s reports',
      headers: {
        token: { type: 'string' },
      },
    },
    handler: async (req) => partslinkService.getReports(req.headers.token),
  });

  server.get<Headers<TokenHeadersDto> & Params<GetReportParamsDto>>('/reports/generate-pdf/:id', {
    preValidation: userGuard,
    schema: {
      ...getReportSchema,
      tags: ['Partslink'],
      description: 'Generate a pdf-report',
    },
    handler: async (req) => partslinkService.generatePdf(req.headers.token, req.params.id),
  });

  server.get<Headers<TokenHeadersDto> & Params<GetReportParamsDto>>('/reports/:id/payment', {
    preValidation: userGuard,
    schema: {
      ...getReportSchema,
      tags: ['Partslink'],
      description: 'Get a report',
    },
    handler: async (req) => partslinkService.getReportPaymentLink(req.headers.token, req.params.id, req.headers['user-agent']),
  });

  server.get<Headers<TokenHeadersDto> & Params<GetReportParamsDto>>('/reports/:id', {
    preValidation: userGuard,
    schema: {
      ...getReportSchema,
      tags: ['Partslink'],
      description: 'Get a report',
    },
    handler: async (req) => partslinkService.getReport(req.headers.token, req.params.id, req.headers['user-agent']),
  });

  server.post<Body<CallbackDto> & Params<{ id: string }>>('/callback/:id', {
    schema: { hide: true },
    handler: async (req, res) => {
      await partslinkService.payReport(req.body, req.params.id);
      res.send(200);
    },
  });

  done();
};

export default partslinkController;
