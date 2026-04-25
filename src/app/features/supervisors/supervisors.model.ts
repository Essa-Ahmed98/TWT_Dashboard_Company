import { PaginatedResult } from '../../core/models/api.models';

export interface SupervisorItem {
  Id: string;
  UserId: string;
  DisplayName?: string;
  PassportNumber: string;
  Nationality: string;
  Gender: string;
  CampaignId: string;
  CampaignName: string;
  Iq: string;
  GroupId: string;
  Specialization: string;
  YearsOfExperience: number;
  Languages: number[];
  IsOnline: boolean;
  IsActive: boolean;
  Notes: string;
  GroupName: string;
}

export interface SupervisorDetailApiItem {
  Id: string;
  UserId: string;
  UserName?: string;
  Name?: string;
  DisplayName?: string;
  Iq?: string;
  Email?: string;
  Phone?: string;
  PhoneNumber?: string;
  PassportNumber: string;
  DateOfBirth?: string;
  Nationality: string;
  Gender: string | number;
  CampaignId: string;
  CampaignName: string;
  GroupId: string;
  GroupName: string;
  PilgrimsCount?: number;
  Specialization: string;
  YearsOfExperience: number;
  Languages: number[];
  IsOnline: boolean;
  IsActive: boolean;
  Notes: string;
  Rating?: number;
  Status?: string;
  JoinDate?: string;
  Location?: string;
}

export interface SupervisorsPageData {
  OnlineCount: number;
  PilgrimCount: number;
  Supervisors: PaginatedResult<SupervisorItem>;
}

export interface SupervisorsQuery {
  pageNumber: number;
  pageSize: number;
  search?: string;
  sortBy?: number;
  status?: number;
}

export interface SupervisorForm {
  email: string;
  displayName: string;
  phone: string;
  password: string;
  campaignId: string;
  groupId: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string | Date;
  gender: string;
  specialization: string;
  yearsOfExperience: string;
  languages: number[];
  notes: string;
}

export interface CreateSupervisorRequest {
  Email: string;
  DisplayName: string;
  Phone: string;
  Password: string;
  CompanyId: string;
  CampaignId: string;
  GroupId: string;
  PassportNumber: string;
  Nationality: string;
  DateOfBirth: string;
  Gender: number;
  Specialization: string;
  YearsOfExperience: number;
  Languages: number[];
  Notes: string;
}

export interface PilgrimGroupItem {
  Id: string;
  UserId: string;
  Nationality: string;
  Gender: number;
  DisplayName: string;
  DateOfBirth: string;
}

export interface PilgrimGroupQuery {
  groupId: string;
  search?: string;
  pageNumber: number;
  pageSize: number;
}

export interface SupervisorReviewApiItem {
  Id: string;
  UserId: string;
  DisplayName: string;
  Category: number;
  Rating: number;
  Comment: string;
  CreatedAt: string;
}

export interface ReviewDistributionItem {
  Stars: number;
  Count: number;
  Percentage: number;
}

export interface SupervisorReviewsSummaryApi {
  AverageRating: number;
  TotalReviews: number;
  PositiveCount: number;
  NegativeCount: number;
  Distribution: ReviewDistributionItem[];
}

export interface SupervisorReviewsApiData {
  Reviews: PaginatedResult<SupervisorReviewApiItem>;
  Ratings: SupervisorReviewsSummaryApi;
}

export const LANGUAGE_OPTIONS: { label: string; value: number }[] = [
  { label: 'العربية', value: 0 },
  { label: 'الإنجليزية', value: 1 },
  { label: 'الأردية', value: 2 },
  { label: 'الألمانية', value: 3 },
  { label: 'الفارسية', value: 4 },
  { label: 'الفلبينية', value: 5 },
  { label: 'الفرنسية', value: 6 },
  { label: 'اليابانية', value: 7 },
  { label: 'الصينية', value: 8 },
  { label: 'التركية', value: 9 },
  { label: 'الروسية', value: 10 },
];
