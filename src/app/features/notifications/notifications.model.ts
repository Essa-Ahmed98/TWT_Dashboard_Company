export enum NotificationAudienceRole {
  All = 0,
  Pilgrims = 1,
  Supervisors = 2,
  Families = 3,
}

export enum NotificationType {
  General = 0,
  Health = 1,
  Location = 2,
  Emergency = 3,
  Dispatch = 4,
  Religious = 5,
  Schedule = 6,
  Message = 7,
}

export interface NotificationAudience {
  Role: NotificationAudienceRole;
  CompanyId: string;
  CampaignId: string | null;
  GroupId: string | null;
}

export interface SendNotificationRequest {
  Title: string;
  Body: string;
  Type: NotificationType;
  IsUrgent: boolean;
  Audience: NotificationAudience;
  Metadata: string;
}

export interface SentNotificationItem {
  Id: string;
  Title: string;
  Body: string;
  Type: NotificationType;
  IsUrgent: boolean;
  RecipientCount: number;
  CreatedAt: string;
}
