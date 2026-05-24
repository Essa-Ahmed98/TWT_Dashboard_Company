export interface TourGroupListItem {
  Id: string;
  GroupNumber: string;
  PilgrimCount: number;
  GroupColor: string;
  TourLeaderId: string;
  TourLeaderName: string;
  TourDateTime: string;
  CenterManagerName: string;
  GroupSupervisorName: string;
  BookedPilgrimCount: number;
  IsFull: boolean;
  IsUserBooked: boolean;
  CreatedAt: string;
}

export interface TourGroupsPagedResult {
  Items: TourGroupListItem[];
  TotalCount: number;
  PageNumber: number;
  PageSize: number;
  TotalPages: number;
}

export interface TourGroupsQuery {
  pageNumber: number;
  pageSize: number;
  sortBy?: string;
  isDescending?: boolean;
  searchTerm?: string;
}
