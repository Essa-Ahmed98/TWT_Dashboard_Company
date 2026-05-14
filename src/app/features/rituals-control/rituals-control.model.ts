export enum RitualProgressStatus {
  NotStarted = 0,
  InProgress = 1,
  Completed = 2,
}

export interface RitualApiItem {
  Id: string;
  Order: number;
  Name: string;
  Description: string;
  HijriDay: number;
  HijriMonth: string;
}

export interface UpdateGroupRitualProgressPayload {
  GroupId: string;
  RitualId: string;
  Status: RitualProgressStatus;
}

export interface RitualsControlCampaignItem {
  Id: string;
  Name: string;
}

export interface RitualsControlGroupItem {
  Id: string;
  Name: string;
}
