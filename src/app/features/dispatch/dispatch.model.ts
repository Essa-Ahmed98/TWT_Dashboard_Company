export interface TransportationScheduleApiItem {
  Id: string;
  CompanyId: string;
  CampaignId: string;
  CampaignName?: string;
  GroupId: string;
  GroupName?: string;
  BusId: string;
  BusName?: string;
  BusNumber?: string;
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

export interface UpdateTransportationScheduleRequest extends CreateTransportationScheduleRequest {
  Id: string;
}
