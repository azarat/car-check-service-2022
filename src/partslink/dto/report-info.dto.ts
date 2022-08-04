import { StatusEnum } from '../enums/status.enum';

export interface ReportInfoDto {
  id: string;
  brand: string;
  vin: string;
  date: string;
  status: StatusEnum;
  data: any;
}
