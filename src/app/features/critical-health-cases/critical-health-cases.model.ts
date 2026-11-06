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
  // vitals are nullable on the server (a reading may not include every value)
  SystolicPressure: number | null;
  DiastolicPressure: number | null;
  HeartRate: number | null;
  Temperature: number | null;
  OxygenSaturation: number | null;
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
