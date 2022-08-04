export interface GetReportParamsDto {
  id: string;
}

export const getReportSchema = {
  headers: {
    token: { type: 'string' },
    'accept-language': { type: 'string' },
    'user-agent': { type: 'string' },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
