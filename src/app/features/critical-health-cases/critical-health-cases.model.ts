import { PaginatedResult } from '../../core/models/api.models';

export interface HealthConditionItem {
  Id: string;
  CompanyId: string;
  CampaignId: string;
  GroupId: string;
  UserId: string;
  PilgrimId: string;
  DisplayName: string;
  Nationality: string;
  DateOfBirth: string;
  SystolicPressure: number;
  DiastolicPressure: number;
  HeartRate: number;
  Temperature: number;
  OxygenSaturation: number;
  MeasuredAt: string;
  Longitude: number;
  Latitude: number;
  ZoneName: string;
}

export type HealthConditionsPage = PaginatedResult<HealthConditionItem>;

export interface HealthConditionsQuery {
  Search?: string;
  CompanyId?: string;
  CampaignId?: string;
  GroupId?: string;
  PageNumber: number;
  PageSize: number;
}
