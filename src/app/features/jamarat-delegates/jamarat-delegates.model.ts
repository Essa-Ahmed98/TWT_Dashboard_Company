export interface DelegateWork {
  From?: string | null;
  To?: string | null;
  MaxConcurrent: number;
  IsAvailable: boolean;
}

export interface DelegateStats {
  TotalCompleted: number;
  AvgRating?: number;
  RatingsCount?: number;
  Awaiting?: number;
  ActiveRequests: number;
}

export interface DelegateListItem {
  DelegateId: string;
  UserId: string;
  FullName: string;
  Email: string;
  Phone: string;
  IdNumber: string;
  Age: number;
  Nationality: string;
  Affiliation: string;
  Work: DelegateWork;
  Stats: DelegateStats;
  ImageUrl?: string;
}

export interface DelegatesPagedResult {
  Items: DelegateListItem[];
  TotalCount: number;
  PageSize: number;
  TotalPages: number;
}

export interface DelegatesQuery {
  searchText?: string;
  affiliation?: string;
  pageNumber: number;
  pageSize: number;
}

export interface PilgrimRequestPilgrim {
  FullName: string;
  Phone: string;
  PhotoUrl?: string;
  Age: number;
  CampaignName: string;
}

export interface PilgrimRequestProof {
  ImageUrls: string[];
  Notes: string;
}

export interface PilgrimRequestRating {
  Score: number;
}

export interface PilgrimRequestDelegate {
  DelegateId: string;
  DelegateName: string;
}

export interface PilgrimRequest {
  Id: string;
  PilgrimId: string;
  Status: string;
  TargetDay: string;
  PilgrimNotes: string;
  CreatedAt: string;
  RespondedAt?: string;
  Pilgrim: PilgrimRequestPilgrim;
  Delegate?: PilgrimRequestDelegate;
  Proof?: PilgrimRequestProof;
  Rating?: PilgrimRequestRating;
}

export interface PilgrimRequestsResult {
  TotalCount: number;
  Requests: PilgrimRequest[];
}
