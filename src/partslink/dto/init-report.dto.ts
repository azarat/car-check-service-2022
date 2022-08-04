export interface InitReportDto {
  brand: string;
  vin: string;
}

export const initReportSchema = {
  tags: ['Partslink'],
  description: 'Create a report request',
  headers: {
    token: { type: 'string' },
    'user-agent': { type: 'string' },
  },
  body: {
    type: 'object',
    required: ['vin', 'brand'],
    properties: {
      vin: { type: 'string' },
      brand: { type: 'string' },
    },
  },
};