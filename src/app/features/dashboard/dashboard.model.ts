export interface DashboardStats {
  CampaignsCount: number;
  GroupsCount: number;
  PilgrimsCount: number;
  SupervisorsCount: number;
  OnlineSupervisorsCount: number;
  BusesCount: number;
}

export interface HealthDistribution {
  StableCount: number;
  WarningCount: number;
  CriticalCount: number;
  PilgrimsCount: number;
}
