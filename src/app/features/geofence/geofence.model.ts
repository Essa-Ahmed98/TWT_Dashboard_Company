export type ZoneType   = 'مشعر مقدس' | 'مخيم حملة';
export type ZoneStatus = 'active' | 'inactive';
export type AlertType  = 'خروج' | 'دخول';

export interface GeofenceZone {
  id: string;
  name: string;
  type: ZoneType;
  description: string;
  lat: number;
  lng: number;
  radius: number;
  opacity: number;
  pilgrimsInside: number;
  color: string;
  status: ZoneStatus;
  visible: boolean;
  alertType?: AlertType;
}

export const ZONE_TYPES: ZoneType[] = [
  'مشعر مقدس', 'مخيم حملة',
];

export interface CreateGeoZoneRequest {
  Name: string;
  Description: string;
  Opacity: string;
  Color: string;
  GeofenceType: number;
  Longitude: number;
  Latitude: number;
  RadiusMeters: number;
}

export interface UpdateGeoZoneRequest extends CreateGeoZoneRequest {
  Id: string;
}

export const ZONE_TYPE_API_MAP: Record<ZoneType, number> = {
  'مشعر مقدس': 0,
  'مخيم حملة': 1,
};

export interface GeoZoneApiItem {
  Id: string;
  Name: string;
  Description: string;
  Opacity: string;
  Color: string;
  CompanyId: string;
  GeofenceType: number;
  Longitude: number;
  Latitude: number;
  RadiusMeters: number;
  PilgrimCount: number;
}

export interface CampaignWithGroupsApiItem {
  Id: string;
  Name: string;
  Number: string;
  GroupsCount: number;
  Groups: CampaignWithGroupsGroupApiItem[];
}

export interface CampaignWithGroupsGroupApiItem {
  Id: string;
  Name: string;
  Notes: string;
  PilgrimCount: number;
}

export interface GroupPilgrimMapApiItem {
  UserId: string;
  DisplayName: string;
  Longitude: number;
  Latitude: number;
}

export const MOCK_ZONES: GeofenceZone[] = [
  {
    id: '1', name: 'المسجد الحرام', type: 'مشعر مقدس', status: 'active',
    description: 'المسجد الحرام ومحيطه المباشر',
    lat: 21.4225, lng: 39.8262, radius: 800, opacity: 0.22, pilgrimsInside: 3200,
    color: '#22c35d', visible: true, alertType: 'خروج',
  },
  {
    id: '2', name: 'منى', type: 'مشعر مقدس', status: 'active',
    description: 'منطقة مخيمات منى',
    lat: 21.4132, lng: 39.8905, radius: 1200, opacity: 0.18, pilgrimsInside: 7100,
    color: '#0b405b', visible: true, alertType: 'دخول',
  },
  {
    id: '3', name: 'عرفات', type: 'مشعر مقدس', status: 'active',
    description: 'جبل الرحمة وسهل عرفات',
    lat: 21.3549, lng: 39.9842, radius: 2000, opacity: 0.26, pilgrimsInside: 9800,
    color: '#1565c0', visible: true, alertType: 'خروج',
  },
  {
    id: '4', name: 'مزدلفة', type: 'مشعر مقدس', status: 'active',
    description: 'المشعر الحرام - مزدلفة',
    lat: 21.3847, lng: 39.9356, radius: 1500, opacity: 0.14, pilgrimsInside: 0,
    color: '#6a1b9a', visible: true, alertType: 'خروج',
  },
  {
    id: '5', name: 'الجمرات', type: 'مشعر مقدس', status: 'active',
    description: 'جسر الجمرات - رمي الجمرات الثلاث',
    lat: 21.4200, lng: 39.8731, radius: 600, opacity: 0.2, pilgrimsInside: 1500,
    color: '#e65100', visible: true, alertType: 'دخول',
  },
  {
    id: '6', name: 'مخيم حملة الولادة', type: 'مخيم حملة', status: 'active',
    description: 'مخيم حملة الولادة والطوارئ',
    lat: 21.4050, lng: 39.8450, radius: 300, opacity: 0.3, pilgrimsInside: 0,
    color: '#e53935', visible: true,
  },
];
