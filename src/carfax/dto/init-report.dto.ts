export interface InitReportDto {
  vin: string;
}

export const initReportSchema = {
  tags: ['Carfax'],
  description: 'Create a report request',
  headers: {
    token: { type: 'string' },
    'accept-language': { type: 'string' },
    'user-agent': { type: 'string' },
  },
  body: {
    type: 'object',
    required: ['vin'],
    properties: {
      vin: { type: 'string' },
    },
  },
};
