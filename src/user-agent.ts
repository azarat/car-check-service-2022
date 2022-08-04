/* eslint-disable import/prefer-default-export */
import config from './config/config';

export const getKeys = (userAgent: string) => {
  const device = ['android', 'ios'].includes(userAgent) ? userAgent : 'android';
  return {
    ios: {
      publicKey: config.liqpayIosPublicKey,
      privateKey: config.liqpayIosPrivateKey,
    },
    android: {
      publicKey: config.liqpayAndroidPublicKey,
      privateKey: config.liqpayAndroidPrivateKey,
    },
  }[device];
};
