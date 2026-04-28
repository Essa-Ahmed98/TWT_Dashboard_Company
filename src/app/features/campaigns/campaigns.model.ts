export type CampaignStatus = 'نشطة' | 'طارئة' | 'مكتملة';
export type GroupStatus    = 'آمن' | 'تحذير' | 'طارئة';
export type BusStatus      = 'متحركة' | 'متوقفة';

// ── Group ────────────────────────────────────────────────────────
export type PilgrimHealth = 'آمن' | 'تحذير' | 'خطر';

export interface GroupSupervisor {
  id:   string;
  name: string;
  role: string;
}

export interface GroupPilgrimEntry {
  id:         string;
  name:       string;
  health:     PilgrimHealth;
  indicators: string;
  location:   string;
}

export interface Group {
  id:               string;
  name:             string;
  status:           GroupStatus;
  pilgrimsCount:    number;
  maxPilgrims:      number;
  supervisorsCount: number;
  notes:            string;
  location:         string;
  supervisors:      GroupSupervisor[];
  pilgrimEntries:   GroupPilgrimEntry[];
}

export interface GroupForm {
  name:  string;
  notes: string;
}

// ── Groups API response ──────────────────────────────────────────
export interface GroupPilgrimApiItem {
  Id:          string;
  UserId:      string;
  Nationality: string;
  Gender:      number;
  HajjType:    number;
  DisplayName: string;
}

export interface GroupApiItem {
  Id:               string;
  Name:             string;
  Notes:            string;
  CampaignId:       string;
  CompanyId:        string;
  PilgrimsCount:    number;
  SupervisorsCount: number;
  Supervisors:      string[];
  Pilgrims:         GroupPilgrimApiItem[];
}

// ── Bus ──────────────────────────────────────────────────────────
export interface Bus {
  id:          string;
  number:      string;
  driverName:  string;
  driverPhone: string;
  plateNumber: string;
  type:        string;
  capacity:    number;
  passengers:  number;
  status:      BusStatus;
  speed:       number;
  route:       string;
  notes:       string;
}

export interface BusForm {
  number:      string;
  driverName:  string;
  driverPhone: string;
  capacity:    string;
  type:        string;
  plateNumber: string;
  notes:       string;
}

// ── Campaign ─────────────────────────────────────────────────────
export type CampaignTab = 'groups' | 'buses';

export interface Campaign {
  id:               string;
  number:           string;
  name:             string;
  status:           CampaignStatus;
  color:            string;
  companyId:        string;
  pilgrimsCount:    number;
  groupsCount:      number;
  supervisorsCount: number;
  busesCount:       number;
  accommodation:    string;
  notes:            string;
  groups:           Group[];
  buses:            Bus[];
}

export interface CampaignForm {
  name:   string;
  number: string;
  color:  string;
}

export const PALETTE_COLORS = [
  '#0b405b', '#1565C0', '#2E7D32', '#6A1B9A',
  '#E65100', '#C62828', '#00695C', '#558B2F',
  '#F9A825', '#37474F',
];

export const BUS_TYPES = ['كبيرة', 'متوسطة', 'صغيرة'];

// ── Companies ────────────────────────────────────────────────────
export interface Company {
  Id:   string;
  Name: string;
}

// ── Buses API response ───────────────────────────────────────────
export interface BusApiItem {
  Id:           string;
  BusNumber:    string;
  DriverName:   string;
  SeatsCount:   number;
  DriverPhone:  string;
  BusType:      string;
  PlateNumber:  string;
  Notes:        string;
  CampaignId:   string;
  CampaignName: string;
  CompanyId:    string;
}

// ── Campaigns API response ───────────────────────────────────────
export interface CampaignApiItem {
  Id:               string;
  Name:             string;
  Number:           string;
  Color:            string;
  CompanyId:        string;
  PilgrimsCount:    number;
  SupervisorsCount: number;
  BusesCount:       number;
  GroupsCount:      number;
}

export interface CampaignsApiData {
  GroupsCount:      number;
  PilgrimCount:     number;
  SupervisorsCount: number;
  Campaigns: {
    Items:        CampaignApiItem[];
    TotalCount:   number;
    PageSize:     number;
    CurrentPage:  number;
    TotalPages:   number;
    HasPrevious:  boolean;
    HasNext:      boolean;
  };
}
