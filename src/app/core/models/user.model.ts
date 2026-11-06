export interface UserLoginResult {
  Token: string;
  Id: string;
  DisplayName: string;
  Email: string;
  Role: string;
  Status: string;
  CompanyId?: string;
  /** Only for staff accounts (role Specific): the sections the company manager gave them */
  Permissions?: string[];
}

/** Stored in localStorage after login */
export interface StoredUser {
  userId: string;
  displayName: string;
  email: string;
  /** 'Admin' = the company manager, 'Specific' = company staff */
  role: string;
  companyId: string;
  /** Staff permissions (e.g. 'Permissions.Pilgrims'); empty for the manager, who can use everything */
  permissions?: string[];
}
