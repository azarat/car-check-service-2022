/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-constructor */
import { ILocalizatedError } from './interfaces';

class HttpError {
  static REPORT_EXIST = {
    en: 'Report is already exists',
    ru: 'Отчет уже существует',
    uk: 'Звіт уже існує',
  }
  static FORBIDDEN = {
    en: 'Access denied',
    ru: 'Доступ закрыт',
    uk: 'Доступ заборонено',
  }
  static VIN_NOT_FOUND = {
    en: 'The vin-номер was not found',
    ru: 'Vin-номер не найден',
    uk: 'Vin-номер не був знайдений',
  }
  static INVALID_VIN = {
    en: 'Unable to process this vin',
    ru: 'Невозможно обработать данный vin-номер',
    uk: 'Неможливо обробити цей vin-номер',
  }

  static REPORT_IS_ALREADY_PAYED = {
    en: 'Report is already payed',
    ru: 'Этот отчет уже оплачен',
    uk: 'Цей звіт вже сплачений',
  }

  constructor(public code: number, public message: string | ILocalizatedError) { }
}

export default HttpError;
