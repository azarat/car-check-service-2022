import { PartslinkTypeEnum } from '../enums/partslink-type.interface';

export interface IPartslinkCarSettings {
  link: string;
  type: PartslinkTypeEnum;
  serviceName?: string;
}

export interface IPartslinkCars {
  [key: string]: IPartslinkCarSettings
}
