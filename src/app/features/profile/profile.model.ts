export interface UserProfile {
  CompanyName: string;
  DisplayName: string;
  Email: string;
  Role: number | string;
  Phone: string;
  AvatarUrl: string;
  CreatedAt?: string | null;
  LastLoginAt?: string | null;
}

export interface UpdateUserProfileRequest {
  Id: string;
  Email: string;
  Phone: string;
  DisplayName: string;
}

export interface ResetPasswordRequest {
  OldPassword: string;
  NewPassword: string;
}
