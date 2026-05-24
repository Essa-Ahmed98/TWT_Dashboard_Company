export interface TourLeaderListItem {
  Id: string;
  UserId?: string;
  DisplayName: string;
  Email: string;
  Phone: string;
  Age: number | null;
  Nationality: string;
  Notes: string;
  CenterManagerName: string;
  GroupSupervisorName: string;
  AvatarUrl?: string | null;
  TourGroupsCount: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TourLeadersPagedResult {
  Items: TourLeaderListItem[];
  TotalCount: number;
  PageNumber: number;
  PageSize: number;
  TotalPages: number;
}

export interface TourLeadersQuery {
  searchText?: string;
  pageNumber: number;
  pageSize: number;
  sortBy?: string;
  isDescending?: boolean;
}
