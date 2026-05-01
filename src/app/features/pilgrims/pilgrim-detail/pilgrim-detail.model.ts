import { BLOOD_TYPE_OPTIONS, PilgrimDetailApiItem } from '../pilgrims.model';

export type PilgrimDetailStatus = 'safe' | 'warning' | 'danger';
export type PilgrimTab = 'personal' | 'health' | 'rituals' | 'family' | 'ratings';
export type RitualStatus = 'done' | 'current' | 'pending';

export interface PilgrimDetailData {
  id: string;
  userId: string;
  campaignId: string;
  groupId: string;
  name: string;
  initials: string;
  status: PilgrimDetailStatus;
  age: number;
  nationality: string;
  location: string;
  phone: string;
  email: string;
  idNumber: string;
  passportNumber: string;
  birthDate: string;
  gender: string;
  company: string;
  campaign: string;
  group: string;
  supervisor: string;
  accommodation: string;
  accommodationLat: number | null;
  accommodationLng: number | null;
  nusukCard: string;
  permitNumber: string;
  hajjYear: string;
  hajjType: number;
  emergencyContact: { name: string; phone: string };
  vitals: { label: string; value: string; icon: string; color: string }[];
  vitalBars: { label: string; value: string; icon: string; pct: number; color: string }[];
  bloodType: string;
  bloodTypeValue: number;
  chronicDiseases: string;
  allergies: string;
  medications: { name: string; times: string[]; dose: string }[];
  rituals: { name: string; date: string; status: RitualStatus }[];
  family: { name: string; relation: string; email: string; phone: string }[];
  ratings: { category: string; stars: number; comment: string; date: string }[];
  log: { event: string; date: string; icon: string; iconColor: string }[];
}

export const STATUS_LABEL: Record<PilgrimDetailStatus, string> = {
  safe: 'آمن',
  warning: 'تحذير',
  danger: 'خطر',
};

const STATUS_COLOR: Record<PilgrimDetailStatus, string> = {
  safe: '#22c35d',
  warning: '#fb8c00',
  danger: '#e53935',
};

const DEFAULT_RITUALS: { name: string; date: string; status: RitualStatus }[] = [
  { name: 'الإحرام', date: '8 ذو الحجة', status: 'done' },
  { name: 'يوم التروية', date: '8 ذو الحجة', status: 'done' },
  { name: 'الوقوف بعرفة', date: '9 ذو الحجة', status: 'current' },
  { name: 'المبيت بمزدلفة', date: '9 ذو الحجة', status: 'pending' },
  { name: 'رمي الجمرات', date: '10 ذو الحجة', status: 'pending' },
  { name: 'طواف الإفاضة', date: '10 ذو الحجة', status: 'pending' },
];

const HAJJ_TYPE_LABEL: Record<number, string> = {
  0: 'إفراد',
  1: 'قِران',
  2: 'تمتع',
};

function formatDateOnly(value: string): string {
  return value ? value.slice(0, 10) : '';
}

function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return 0;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return Math.max(age, 0);
}

function genderLabel(value: number): string {
  return value === 0 ? 'ذكر' : 'أنثى';
}

function bloodTypeLabel(value: number): string {
  return BLOOD_TYPE_OPTIONS.find(option => option.value === value)?.label ?? 'غير محدد';
}

function hajjTypeLabel(value: number): string {
  return HAJJ_TYPE_LABEL[value] ?? `نوع ${value + 1}`;
}

function ritualStatusText(pilgrim: PilgrimDetailApiItem): string {
  return pilgrim.CurrentRitualStatusText?.trim() || '';
}

function buildRitualTimeline(currentStatus: number): { name: string; date: string; status: RitualStatus }[] {
  const currentIndex = Math.min(Math.max(currentStatus, 0), DEFAULT_RITUALS.length - 1);

  return DEFAULT_RITUALS.map((step, index) => ({
    ...step,
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
  }));
}

export function pilgrimApiToDetailData(pilgrim: PilgrimDetailApiItem): PilgrimDetailData {
  const status: PilgrimDetailStatus = 'safe';
  const color = STATUS_COLOR[status];
  const bloodType = bloodTypeLabel(pilgrim.BloodType);
  const currentRitual = ritualStatusText(pilgrim);

  return {
    id: pilgrim.Id,
    userId: pilgrim.UserId,
    campaignId: pilgrim.CampaignId,
    groupId: pilgrim.GroupId,
    name: pilgrim.DisplayName,
    initials: pilgrim.DisplayName?.charAt(0) || '?',
    status,
    age: calculateAge(pilgrim.DateOfBirth),
    nationality: pilgrim.Nationality,
    location: currentRitual,
    phone: pilgrim.Phone,
    email: pilgrim.Email,
    idNumber: pilgrim.IDNumber,
    passportNumber: pilgrim.PassportNumber,
    birthDate: formatDateOnly(pilgrim.DateOfBirth),
    gender: genderLabel(pilgrim.Gender),
    company: `نوع الحج: ${hajjTypeLabel(pilgrim.HajjType)}`,
    campaign: pilgrim.CampaignName,
    group: pilgrim.GroupName,
    supervisor: 'غير متوفر',
    accommodation: pilgrim.Accommodation,
    accommodationLat: pilgrim.AccommodationLat ?? null,
    accommodationLng: pilgrim.AccommodationLong ?? null,
    nusukCard: pilgrim.NuskCardNumber,
    permitNumber: pilgrim.PermitNumber,
    hajjYear: '1447',
    hajjType: pilgrim.HajjType,
    emergencyContact: { name: 'غير متوفر', phone: 'غير متوفر' },
    vitals: [
      { label: 'فصيلة الدم', value: bloodType, icon: 'pi pi-heart', color },
      { label: 'رقم جواز السفر', value: pilgrim.PassportNumber, icon: 'pi pi-id-card', color },
      { label: 'رقم التصريح', value: pilgrim.PermitNumber, icon: 'pi pi-ticket', color },
      { label: 'الحالة الحالية', value: currentRitual || 'غير متوفر', icon: 'pi pi-map-marker', color },
    ],
    vitalBars: [],
    bloodType,
    bloodTypeValue: pilgrim.BloodType,
    chronicDiseases: 'غير متوفر',
    allergies: 'غير متوفر',
    medications: [],
    rituals: buildRitualTimeline(pilgrim.CurrentRitualStatus),
    family: [],
    ratings: [],
    log: [
      { event: 'تم جلب بيانات الحاج من النظام', date: 'الآن', icon: 'pi pi-download', iconColor: '#0b405b' },
      { event: `الانضمام إلى ${pilgrim.CampaignName}`, date: 'بيانات المركز', icon: 'pi pi-building', iconColor: '#2563eb' },
    ],
  };
}
