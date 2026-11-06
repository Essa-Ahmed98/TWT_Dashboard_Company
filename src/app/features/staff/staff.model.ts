/** A staff account of the company (GET api/Users/specific) */
export interface StaffMember {
  Id: string;
  Email: string | null;
  DisplayName: string;
  Phone: string | null;
  CompanyId: string | null;
  /** backend UserStatus { Active = 0, Inactive = 1, Suspended = 2, Pending = 3 } */
  Status: number;
  Permissions: string[];
  CreatedAt?: string | null;
  LastLoginAt?: string | null;
}

/** POST api/Users/specific - the server puts the staff member in the manager's company */
export interface CreateStaffPayload {
  DisplayName: string;
  Email: string;
  Phone: string | null;
  Password: string;
  Permissions: string[];
}

/** PUT api/Users/permissions */
export interface UpdateStaffPayload {
  UserId: string;
  DisplayName: string;
  Email: string;
  Phone: string | null;
  Permissions: string[];
}

export const STAFF_STATUS = {
  Active: 0,
  Inactive: 1,
  Suspended: 2,
  Pending: 3,
} as const;

/**
 * The same rules as the server (CreateSpecificUserCommandValidator / UpdateUserPermissionsCommandValidator):
 * name required, at most 100 characters; email required, name@domain.tld; phone optional, Saudi mobile;
 * password (new staff only) at least 6 characters; at least one permission.
 */
export const STAFF_RULES = {
  nameMaxLength: 100,
  passwordMinLength: 6,
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  saudiPhone: /^(?:\+966|00966|966|0)?5\d{8}$/,
} as const;
