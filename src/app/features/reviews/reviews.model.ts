import { PaginatedResult } from '../../core/models/api.models';

export interface ReviewApiItem {
  Id: string;
  UserId: string;
  DisplayName: string;
  Category: number;
  Rating: number;
  Comment: string;
  GroupId: string;
  CampaignId: string;
  CampaignName: string;
  GroupName: string;
  CompanyId: string;
  CreatedAt: string;
}

export interface ReviewDistributionApiItem {
  Stars: number;
  Count: number;
  Percentage: number;
}

export interface ReviewCategorySummaryApiItem {
  Category: number;
  Rating: number;
  ReviewsCount: number;
}

export interface ReviewsSummaryApiData {
  AverageRating: number;
  TotalReviews: number;
  PositiveCount: number;
  NegativeCount: number;
  Distribution: ReviewDistributionApiItem[];
}

export interface ReviewsApiData {
  Reviews: PaginatedResult<ReviewApiItem>;
  Ratings: ReviewsSummaryApiData;
  Categories: ReviewCategorySummaryApiItem[];
}

export interface ReviewsQuery {
  CompanyId: string;
  Search?: string;
  GroupId?: string;
  CampaignId?: string;
  Category?: number;
  Rating?: number;
  SortBy?: number;
  PageNumber: number;
  PageSize: number;
}
