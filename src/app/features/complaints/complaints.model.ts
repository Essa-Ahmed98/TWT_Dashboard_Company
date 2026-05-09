import { PaginatedResult } from '../../core/models/api.models';

export enum ComplaintStatus {
  Open = 0,
  Solved = 1,
  Closed = 2,
}

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
  Status: ComplaintStatus;
  AssignerId: string;
  AssignerName: string;
}

export interface ComplaintsResponseData {
  OpenCount: number;
  SolvedCount: number;
  ClosedCount: number;
  Complaints: PaginatedResult<ComplaintApiItem>;
}

export interface ComplaintsQuery {
  CompanyId?: string;
  CampaignId?: string;
  GroupId?: string;
  SupervisorId?: string;
  StatusFilter?: number;
  PageNumber: number;
  PageSize: number;
}

export interface CampaignDropdownItem {
  Id: string;
  Name: string;
}

export interface GroupDropdownItem {
  Id: string;
  Name: string;
}

export interface SupervisorDropdownItem {
  Id: string;
  UserId: string;
  Name: string;
}
