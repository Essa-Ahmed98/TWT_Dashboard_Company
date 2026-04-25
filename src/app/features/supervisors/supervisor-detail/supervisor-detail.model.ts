import { LANGUAGE_OPTIONS, SupervisorDetailApiItem } from '../supervisors.model';

export type SupervisorTab = 'personal' | 'pilgrims' | 'ratings' | 'performance';
export type SupervisorStatusClass = 'online' | 'offline' | 'leave';
export type PilgrimStatusClass = 'safe' | 'warning' | 'danger';

export interface SupervisorPilgrim {
  id: string;
  name: string;
  age: number;
  location: string;
  status: PilgrimStatusClass;
  initials: string;
}

export interface SupervisorRating {
  pilgrimName: string;
  pilgrimInitials: string;
  stars: number;
  label: string;
  comment: string;
  date: string;
}

export interface SupervisorTask {
  label: string;
  time: string;
  done: boolean;
}

export interface SupervisorReport {
  title: string;
  date: string;
}

export interface SupervisorDetailData {
  id: string;
  userId: string;
  groupId: string;
  name: string;
  initials: string;
  statusClass: SupervisorStatusClass;
  status: string;
  campaignName: string;
  group: string;
  email: string;
  phone: string;
  languages: string;
  passportNumber: string;
  birthDate: string;
  nationality: string;
  gender: string;
  qualification: string;
  yearsOfExperience: number;
  joinDate: string;
  notes: string;
  pilgrimsCount: number;
  rating: number;
  vitals: { label: string; value: string; icon: string; color: string }[];
  pilgrims: SupervisorPilgrim[];
  pilgrimStats: { label: string; value: number; color: string }[];
  ratings: SupervisorRating[];
  ratingAvg: number;
  ratingCount: number;
  ratingDist: { stars: number; pct: number; count: number }[];
  tasks: SupervisorTask[];
  tasksDone: number;
  tasksTotal: number;
  tasksCompletionPct: number;
  performanceMetrics: { label: string; pct: number; color: string }[];
  reports: SupervisorReport[];
  log: { event: string; date: string; icon: string; iconColor: string }[];
}

const EMPTY_VALUE = '—';

function displayValue(value: unknown): string {
  if (value == null) {
    return EMPTY_VALUE;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : EMPTY_VALUE;
}

function displayNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return displayValue(value);
  }

  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getSupervisorName(api: SupervisorDetailApiItem): string {
  return displayValue(api.DisplayName ?? api.Name ?? api.Iq ?? api.UserName ?? api.UserId);
}

function getInitials(name: string): string {
  if (name === EMPTY_VALUE) {
    return 'م';
  }

  const parts = name
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  const letters = parts.map(part => part[0]).join('');
  return letters || name[0] || 'م';
}

function genderLabel(value: string | number | null | undefined): string {
  if (value === 0 || value === '0') {
    return 'ذكر';
  }
  if (value === 1 || value === '1') {
    return 'أنثى';
  }

  const text = String(value ?? '').trim().toLowerCase();
  if (!text) {
    return EMPTY_VALUE;
  }

  if (['male', 'man', 'ذكر'].includes(text)) {
    return 'ذكر';
  }
  if (['female', 'woman', 'أنثى'].includes(text)) {
    return 'أنثى';
  }

  return displayValue(value);
}

function languagesLabel(values: number[] | null | undefined): string {
  if (!values?.length) {
    return EMPTY_VALUE;
  }

  return values
    .map(value => LANGUAGE_OPTIONS.find(option => option.value === value)?.label ?? String(value))
    .join('، ');
}

function getStatus(api: SupervisorDetailApiItem): { status: string; statusClass: SupervisorStatusClass } {
  const rawStatus = String(api.Status ?? '').trim().toLowerCase();

  if (rawStatus.includes('leave') || rawStatus.includes('vacation') || rawStatus.includes('إجاز')) {
    return { status: 'في إجازة', statusClass: 'leave' };
  }
  if (rawStatus.includes('online') || rawStatus.includes('connected') || rawStatus.includes('متصل')) {
    return { status: 'متصل', statusClass: 'online' };
  }
  if (rawStatus.includes('offline') || rawStatus.includes('غير')) {
    return { status: 'غير متصل', statusClass: 'offline' };
  }

  if (api.IsOnline) {
    return { status: 'متصل', statusClass: 'online' };
  }

  if (api.IsActive === false) {
    return { status: 'في إجازة', statusClass: 'leave' };
  }

  return { status: 'غير متصل', statusClass: 'offline' };
}

export function supervisorApiToDetailData(api: SupervisorDetailApiItem): SupervisorDetailData {
  const name = getSupervisorName(api);
  const statusInfo = getStatus(api);
  const pilgrimsCount = displayNumber(api.PilgrimsCount);
  const yearsOfExperience = displayNumber(api.YearsOfExperience);
  const rating = displayNumber(api.Rating);
  const tasksDone = 0;
  const tasksTotal = 0;

  return {
    id: displayValue(api.Id),
    userId: displayValue(api.UserId),
    groupId: api.GroupId ?? '',
    name,
    initials: getInitials(name),
    statusClass: statusInfo.statusClass,
    status: statusInfo.status,
    campaignName: displayValue(api.CampaignName ?? api.CampaignId),
    group: displayValue(api.GroupName ?? api.GroupId),
    email: displayValue(api.Email),
    phone: displayValue(api.PhoneNumber ?? api.Phone),
    languages: languagesLabel(api.Languages),
    passportNumber: displayValue(api.PassportNumber),
    birthDate: formatDate(api.DateOfBirth),
    nationality: displayValue(api.Nationality),
    gender: genderLabel(api.Gender),
    qualification: displayValue(api.Specialization),
    yearsOfExperience,
    joinDate: formatDate(api.JoinDate),
    notes: displayValue(api.Notes),
    pilgrimsCount,
    rating,
    vitals: [
      { label: 'عدد الحجاج', value: String(pilgrimsCount), icon: 'pi pi-users', color: '#0b405b' },
      { label: 'سنوات الخبرة', value: String(yearsOfExperience), icon: 'pi pi-briefcase', color: '#22c35d' },
      { label: 'رقم الجواز', value: displayValue(api.PassportNumber), icon: 'pi pi-id-card', color: '#3b82f6' },
      { label: 'التقييم', value: rating > 0 ? String(rating) : EMPTY_VALUE, icon: 'pi pi-star-fill', color: '#f59e0b' },
    ],
    pilgrims: [],
    pilgrimStats: [
      { label: 'إجمالي الحجاج', value: pilgrimsCount, color: '#0b405b' },
      { label: 'يحتاجون متابعة', value: 0, color: '#fb8c00' },
      { label: 'حالات حرجة', value: 0, color: '#e53935' },
    ],
    ratings: [],
    ratingAvg: rating,
    ratingCount: 0,
    ratingDist: [5, 4, 3, 2, 1].map(stars => ({ stars, pct: 0, count: 0 })),
    tasks: [],
    tasksDone,
    tasksTotal,
    tasksCompletionPct: 0,
    performanceMetrics: [
      { label: 'إنجاز المهام', pct: 0, color: '#0b405b' },
      { label: 'الاستجابة للتنبيهات', pct: 0, color: '#22c35d' },
      { label: 'رضا الحجاج', pct: rating > 0 ? Math.min(100, Math.round((rating / 5) * 100)) : 0, color: '#f59e0b' },
      { label: 'الالتزام العام', pct: api.IsActive ? 100 : 0, color: '#60a5fa' },
    ],
    reports: [],
    log: [
      {
        event: `تم تحميل بيانات المشرف ${name}`,
        date: formatDate(api.JoinDate),
        icon: 'pi pi-user',
        iconColor: '#0b405b',
      },
      {
        event: `تعيين على ${displayValue(api.CampaignName ?? api.CampaignId)} - ${displayValue(api.GroupName ?? api.GroupId)}`,
        date: EMPTY_VALUE,
        icon: 'pi pi-briefcase',
        iconColor: '#7c3aed',
      },
    ],
  };
}
