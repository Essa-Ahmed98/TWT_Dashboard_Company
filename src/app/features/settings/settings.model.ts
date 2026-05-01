export interface CompanySettingsApiItem {
  Id: string;
  CompanyId: string;
  IconPath: string;
  HealthEnabled: boolean;
  LocationEnabled: boolean;
  DocumentsEnabled: boolean;
  RitualsEnabled: boolean;
  ReviewsEnabled: boolean;
  ComplaintsEnabled: boolean;
  TransportationEnabled: boolean;
  CommunicationEnabled: boolean;
}

export interface UpdateCompanySettingsRequest {
  HealthEnabled: boolean;
  LocationEnabled: boolean;
  DocumentsEnabled: boolean;
  RitualsEnabled: boolean;
  ReviewsEnabled: boolean;
  ComplaintsEnabled: boolean;
  TransportationEnabled: boolean;
  CommunicationEnabled: boolean;
  Icon?: File | null;
}

export interface FeatureItem {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
}
