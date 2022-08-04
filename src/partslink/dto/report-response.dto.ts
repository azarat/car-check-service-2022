import { PartslinkTypeEnum } from '../../config/enums/partslink-type.interface';
import { StatusEnum } from '../enums/status.enum';

export interface ReportResponseDto {
  id: string;
  reportType: PartslinkTypeEnum,
  brand: string;
  vin: string;
  data: any;
  paymentLink?: string;
  status?: StatusEnum;
}
