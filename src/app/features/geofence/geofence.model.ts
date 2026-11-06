/** mirrors the backend GeofenceType enum: AssemblyPoint = 0, Custom = 1, Location = 2 */
export type ZoneType   = 'assembly' | 'custom' | 'location';
export type ZoneStatus = 'active' | 'inactive';
export type AlertType  = 'exit' | 'enter';

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
  companyId: string;
  alertType?: AlertType;
}

export const ZONE_TYPES: ZoneType[] = ['assembly', 'custom', 'location'];

export const ZONE_TYPE_LABEL_KEYS: Record<ZoneType, string> = {
  assembly: 'GEOFENCE.TYPE_ASSEMBLY_POINT',
  custom:   'GEOFENCE.TYPE_CUSTOM',
  location: 'GEOFENCE.TYPE_LOCATION',
};

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
  assembly: 0,
  custom:   1,
  location: 2,
};

export const ZONE_TYPE_FROM_API: Record<number, ZoneType> = {
  0: 'assembly',
  1: 'custom',
  2: 'location',
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
  IsSupervisor?: boolean;
  ZoneName?: string | null;
}

export const MOCK_ZONES: GeofenceZone[] = [
  {
    id: '1', name: 'المسجد الحرام', type: 'location', status: 'active',
    description: 'المسجد الحرام ومحيطه المباشر',
    lat: 21.4225, lng: 39.8262, radius: 800, opacity: 0.22, pilgrimsInside: 3200,
    color: '#22c35d', visible: true, companyId: '', alertType: 'exit',
  },
  {
    id: '2', name: 'منى', type: 'location', status: 'active',
    description: 'منطقة مخيمات منى',
    lat: 21.4132, lng: 39.8905, radius: 1200, opacity: 0.18, pilgrimsInside: 7100,
    color: '#0b405b', visible: true, companyId: '', alertType: 'enter',
  },
  {
    id: '3', name: 'عرفات', type: 'location', status: 'active',
    description: 'جبل الرحمة وسهل عرفات',
    lat: 21.3549, lng: 39.9842, radius: 2000, opacity: 0.26, pilgrimsInside: 9800,
    color: '#1565c0', visible: true, companyId: '', alertType: 'exit',
  },
  {
    id: '4', name: 'مزدلفة', type: 'location', status: 'active',
    description: 'المشعر الحرام - مزدلفة',
    lat: 21.3847, lng: 39.9356, radius: 1500, opacity: 0.14, pilgrimsInside: 0,
    color: '#6a1b9a', visible: true, companyId: '', alertType: 'exit',
  },
  {
    id: '5', name: 'الجمرات', type: 'location', status: 'active',
    description: 'جسر الجمرات - رمي الجمرات الثلاث',
    lat: 21.4200, lng: 39.8731, radius: 600, opacity: 0.2, pilgrimsInside: 1500,
    color: '#e65100', visible: true, companyId: '', alertType: 'enter',
  },
  {
    id: '6', name: 'مخيم مركز الولادة', type: 'custom', status: 'active',
    description: 'مخيم مركز الولادة والطوارئ',
    lat: 21.4050, lng: 39.8450, radius: 300, opacity: 0.3, pilgrimsInside: 0,
    color: '#e53935', visible: true, companyId: '',
  },
];
