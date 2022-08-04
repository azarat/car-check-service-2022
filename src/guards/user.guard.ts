import { FastifyReply, FastifyRequest } from 'fastify';
import { verifyUser } from '@day-drive/user-sdk/lib/cjs';
import config from '../config/config';

import HttpError from '../errors/HttpError';

export const userGuard = async (req: FastifyRequest, _: FastifyReply) => {
  const { token } = req.headers;
  if (!token) {
    throw new HttpError(403, 'Provide a token');
  }

  try {
    await verifyUser(
      config.userSdkUrl,
      config.userSdkSecret,
      token as string,
    );
  } catch (err) {
    throw new HttpError(401, 'Token is invalid');
  }
};
