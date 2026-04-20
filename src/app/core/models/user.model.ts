export interface UserLoginResult {
  Token: string;
  Id: string;
  DisplayName: string;
  Email: string;
  Role: string;
  Status: string;
}

/** Stored in localStorage after login */
export interface StoredUser {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  companyId: string;
}
