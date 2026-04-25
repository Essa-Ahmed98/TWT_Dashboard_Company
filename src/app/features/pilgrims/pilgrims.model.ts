export type PilgrimStatus = 'آمن' | 'تحذير' | 'خطر';
export type Gender       = 'ذكر' | 'أنثى';

export interface Campaign {
  id:   string;
  name: string;
}

export interface FamilyMember {
  id:       string;
  name:     string;
  phone:    string;
  relation: string;
}

export interface Pilgrim {
  id:                    string;   // P-001
  name:                  string;
  email:                 string;
  phone:                 string;
  age:                   number;
  nationality:           string;
  nationalId:            string;
  passportNumber:        string;
  gender:                Gender;
  birthDate:             string;
  bloodType:             string;
  campaignId:            string;
  campaignName:          string;
  group:                 string;
  supervisorName:        string;
  status:                PilgrimStatus;
  location:              string;
  accommodation:         string;
  notes:                 string;
  emergencyContactName:  string;
  emergencyContactPhone: string;
  familyMembers:         FamilyMember[];
}

export interface PilgrimForm {
  displayName:      string;
  email:            string;
  phone:            string;
  campaignId:       string;
  groupId:          string;
  passportNumber:   string;
  nationality:      string;
  dateOfBirth:      string | Date;
  gender:           string;   // '0' | '1'
  idNumber:         string;
  accommodation:    string;
  ritualCardNumber: string;
  permitNumber:     string;
  bloodType:        string;   // enum value as string
}

export interface CreatePilgrimRequest {
  Email:            string;
  DisplayName:      string;
  Phone:            string;
  CompanyId:        string;
  CampaignId:       string;
  GroupId:          string;
  PassportNumber:   string;
  Nationality:      string;
  DateOfBirth:      string;
  Gender:           number;
  IDNumber:         string;
  Accommodation:    string;
  NuskCardNumber:   string;
  PermitNumber:     string;
  BloodType:        number;
}

export interface UpdatePilgrimRequest {
  Id:               string;
  HajjType:         number;
  PassportNumber:   string;
  Nationality:      string;
  DateOfBirth:      string;
  Gender:           number;
  IDNumber:         string;
  Accommodation:    string;
  NuskCardNumber:   string;
  PermitNumber:     string;
  BloodType:        number;
  Email:            string;
  DisplayName:      string;
  Phone:            string;
}

// ── Lookup data ─────────────────────────────────────────────────
export const CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'مركز الراجحي' },
  { id: '2', name: 'مركز النور'    },
  { id: '3', name: 'مركز الفرقان' },
  { id: '4', name: 'مركز البيمان' },
  { id: '5', name: 'مركز البركة'  },
  { id: '6', name: 'مركز الهدى'   },
];

export const GROUPS = ['فوج ١', 'فوج ٢', 'فوج ٣', 'فوج أ', 'فوج ب', 'فوج ج'];

export const BLOOD_TYPE_OPTIONS: { label: string; value: number }[] = [
  { label: 'A+',  value: 0 },
  { label: 'A-',  value: 1 },
  { label: 'B+',  value: 2 },
  { label: 'B-',  value: 3 },
  { label: 'AB+', value: 4 },
  { label: 'AB-', value: 5 },
  { label: 'O+',  value: 6 },
  { label: 'O-',  value: 7 },
];

// ── Admin list API ───────────────────────────────────────────────
export interface PilgrimApiItem {
  Id:                  string;
  UserId:              string;
  PassportNumber:      string;
  Nationality:         string;
  Gender:              number;
  CampaignId:          string;
  CampaignName:        string;
  GroupId:             string;
  CompanyId:           string;
  GroupName:           string;
  HajjType:            number;
  CurrentRitualStatus: number;
  DisplayName:         string;
  Phone:               string;
}

export interface PilgrimDetailApiItem {
  Id:                       string;
  UserId:                   string;
  DisplayName:              string;
  PassportNumber:           string;
  Nationality:              string;
  DateOfBirth:              string;
  Gender:                   number;
  CampaignId:               string;
  CampaignName:             string;
  GroupId:                  string;
  GroupName:                string;
  HajjType:                 number;
  CurrentRitualStatus:      number;
  CurrentRitualStatusText?: string;
  Email:                    string;
  Phone:                    string;
  IDNumber:                 string;
  Accommodation:            string;
  NuskCardNumber:           string;
  PermitNumber:             string;
  BloodType:                number;
}

export interface PilgrimFamilyApiItem {
  Name:  string;
  Phone: string;
  Email: string;
}

export interface ReviewApiItem {
  Id:        string;
  Category:  number;
  Rating:    number;
  Comment:   string;
  CreatedAt: string;
}

export interface PilgrimRitualApiItem {
  Id:               string;
  Order:            number;
  HijriDay:         number;
  HijriMonth:       number;
  Name:             string;
  ShortDescription: string;
  Status:           number;
  IsCurrent:        boolean;
}

export interface PilgrimRitualsApiItem {
  HajjType:             number;
  CurrentRitualId:      string;
  TotalRituals:         number;
  CompletedRituals:     number;
  CompletionPercentage: number;
  Rituals:              PilgrimRitualApiItem[];
}

export interface DrugApiItem {
  Id:                string;
  UserId:            string;
  Name:              string;
  Dosage:            string;
  DrugFrequency:     number;
  IntakeTimes:       string[];
  HasAdditionalTime: boolean;
  IsActive:          boolean;
  Notes:             string;
  CreatedAt:         string;
}

export interface PilgrimsQuery {
  Search?:     string;
  CampaignId?: string;
  SortBy?:     number;
  PageNumber?: number;
  PageSize?:   number;
}
