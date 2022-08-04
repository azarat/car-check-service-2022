import { FastifyInstance } from 'fastify';

import { userGuard } from '../guards/user.guard';
import { Params } from '../types';
import carNumberService from './car-number.service';
import { GetVinDto } from './dto/plate.dto';

const carNumberController = (server: FastifyInstance, _, done) => {
  server.get<Params<GetVinDto>>('/by-plate/:licensePlate', {
    preValidation: userGuard,
    schema: {
      tags: ['Check'],
      description: "Get car's vin aviable cars",
      headers: {
        token: { type: 'string' },
        'accept-language': { type: 'string' },
      },
      params: {
        licensePlate: { type: 'string' },
      },
      response: {
        200: { type: 'string' },
      },
    },
  }, async (req) => carNumberService.getVinByPlate(req.params.licensePlate));
  done();
};

export default carNumberController;
