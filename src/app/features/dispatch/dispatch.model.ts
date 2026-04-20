export interface TransportationScheduleApiItem {
  Id: string;
  CompanyId: string;
  CampaignId: string;
  GroupId: string;
  BusId: string;
  FromLocation: string;
  ToLocation: string;
  DepartureTime: string;
  Notes: string;
}

export interface TransportationSchedulesQuery {
  CompanyId: string;
  CampaignId?: string;
  GroupId?: string;
  BusId?: string;
  Search?: string;
  PageNumber: number;
  PageSize: number;
}

export interface CreateTransportationScheduleRequest {
  CompanyId: string;
  CampaignId: string;
  GroupId: string;
  BusId: string;
  FromLocation: string;
  ToLocation: string;
  DepartureTime: string;
  Notes: string;
}
