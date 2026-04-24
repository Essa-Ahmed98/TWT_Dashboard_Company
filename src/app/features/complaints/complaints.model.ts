import { PaginatedResult } from '../../core/models/api.models';

export interface ComplaintApiItem {
  Id: string;
  Title: string;
  Description: string;
  DisplayName: string;
  Phone: string;
  CompanyName: string;
  CampaignName: string;
  GroupName: string;
  CreatedAt: string;
}

export type ComplaintsApiData = PaginatedResult<ComplaintApiItem>;

export interface ComplaintsQuery {
  CompanyId: string;
  CampaignId?: string;
  GroupId?: string;
  SortBy?: number;
  PageNumber: number;
  PageSize: number;
}
