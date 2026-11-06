/**
 * Staff permissions (server: TWT.Shared.Security.Permissions). The company manager (role Admin) can use every
 * section; a staff account (role Specific with the company's CompanyId) only the sections it was given.
 */
export const PERMISSIONS = {
  Campaigns: 'Permissions.Campaigns',
  Buses: 'Permissions.Buses',
  Pilgrims: 'Permissions.Pilgrims',
  Supervisors: 'Permissions.Supervisors',
  Groups: 'Permissions.Groups',
  Devices: 'Permissions.Devices',
  Delegates: 'Permissions.Delegates',
  TourLeaders: 'Permissions.TourLeaders',
  Complaints: 'Permissions.Complaints',
  Dashboards: 'Permissions.Dashboards',
  Emergencies: 'Permissions.Emergencies',
  GeoZones: 'Permissions.GeoZones',
  SupervisorTasks: 'Permissions.SupervisorTasks',
  Broadcast: 'Permissions.Broadcast',
  Notifications: 'Permissions.Notifications',
  Reviews: 'Permissions.Reviews',
} as const;

/** One permission, or a list where any one of them is enough */
export type PermissionRule = string | readonly string[];

const P = PERMISSIONS;

/**
 * The chat page is open to every account of the dashboard: the management chat (the company manager and its staff,
 * inside the company) needs no permission. Chatting / calling pilgrims and supervisors follows these permissions
 * (any one of them, same rule as the chat server); without them the page shows only the "management" tab.
 */
export const CHAT_FIELD_PERMISSIONS = [P.Pilgrims, P.Supervisors] as const;

/** Groups and buses live inside a campaign, so their permissions also open the campaigns pages (read only) */
export const CAMPAIGN_PAGE_PERMISSIONS = [P.Campaigns, P.Groups, P.Buses] as const;

/**
 * The pages a staff member may land on, in order: after login (and on a page they cannot open)
 * they go to the first one they are allowed to use.
 */
export const STAFF_LANDING_ROUTES: { route: string; permission: PermissionRule }[] = [
  { route: '/dashboard', permission: P.Dashboards },
  { route: '/campaigns', permission: CAMPAIGN_PAGE_PERMISSIONS },
  { route: '/pilgrims', permission: P.Pilgrims },
  { route: '/supervisors', permission: P.Supervisors },
  { route: '/complaints', permission: P.Complaints },
  { route: '/reviews', permission: P.Reviews },
  { route: '/notifications', permission: P.Notifications },
  { route: '/broadcast', permission: P.Broadcast },
  { route: '/tasks', permission: P.SupervisorTasks },
  { route: '/dispatch', permission: P.Buses },
  { route: '/geo-fence', permission: P.GeoZones },
  { route: '/critical-health-cases', permission: P.Emergencies },
  { route: '/devices', permission: P.Devices },
  { route: '/tour-leaders', permission: P.TourLeaders },
  { route: '/jamarat-delegates', permission: P.Delegates },
  // every staff member has the management chat, so it is the last landing page (instead of "no access")
  { route: '/chat', permission: [] },
];

/** The permission picker of the staff page, grouped by kind of work */
export interface PermissionGroup {
  key: string;
  labelKey: string;
  permissions: string[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'overview',
    labelKey: 'STAFF.GROUPS.OVERVIEW',
    permissions: [P.Dashboards, P.Campaigns, P.Groups, P.Buses],
  },
  {
    key: 'people',
    labelKey: 'STAFF.GROUPS.PEOPLE',
    permissions: [P.Pilgrims, P.Supervisors, P.Devices, P.TourLeaders, P.Delegates],
  },
  {
    key: 'field',
    labelKey: 'STAFF.GROUPS.FIELD',
    permissions: [P.GeoZones, P.Emergencies, P.SupervisorTasks],
  },
  {
    key: 'communication',
    labelKey: 'STAFF.GROUPS.COMMUNICATION',
    permissions: [P.Complaints, P.Reviews, P.Notifications, P.Broadcast],
  },
];

/** Every permission the picker offers */
export const PICKER_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(group => group.permissions);

/** i18n key of a permission name, e.g. 'Permissions.TourLeaders' -> 'STAFF.PERMS.TOUR_LEADERS' */
export function permissionLabelKey(permission: string): string {
  const name = permission.replace(/^Permissions\./, '');
  return `STAFF.PERMS.${name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
}

/** i18n key of the short "what it opens" hint of a permission */
export function permissionHintKey(permission: string): string {
  return permissionLabelKey(permission).replace('STAFF.PERMS.', 'STAFF.PERM_HINTS.');
}
