import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth-guard';
import { noAuthGuard } from './core/auth/guards/no-auth-guard';
import { permissionGuard } from './core/auth/guards/permission-guard';
import { AuthService } from './core/auth/services/auth';
import { CAMPAIGN_PAGE_PERMISSIONS, PERMISSIONS as P, PermissionRule } from './core/auth/permissions';

/** A feature page that needs a permission (the company manager passes every check) */
const needs = (permission: PermissionRule) => ({ canActivate: [permissionGuard], data: { permission } });

/** A page of the company manager only (never staff) */
const adminOnly = { canActivate: [permissionGuard], data: { adminOnly: true } };

export const routes: Routes = [
  {
    path: 'pilgrims/profile/:id',
    loadComponent: () =>
      import('./features/pilgrims/pilgrim-profile/pilgrim-profile').then((m) => m.PilgrimProfile),
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [noAuthGuard],
        loadComponent: () =>
          import('./features/auth/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'dashboard',
        ...needs(P.Dashboards),
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'campaigns',
        ...needs(CAMPAIGN_PAGE_PERMISSIONS),
        loadComponent: () =>
          import('./features/campaigns/campaigns').then((m) => m.Campaigns),
      },
      {
        path: 'campaigns/:id',
        ...needs(CAMPAIGN_PAGE_PERMISSIONS),
        loadComponent: () =>
          import('./features/campaigns/campaign-detail/campaign-detail').then((m) => m.CampaignDetail),
      },
      {
        path: 'geo-fence',
        ...needs(P.GeoZones),
        loadComponent: () =>
          import('./features/geofence/geofence').then((m) => m.Geofence),
      },
      {
        path: 'dispatch',
        ...needs(P.Buses),
        loadComponent: () =>
          import('./features/dispatch/dispatch').then((m) => m.Dispatch),
      },
      {
        path: 'pilgrims',
        ...needs(P.Pilgrims),
        loadComponent: () =>
          import('./features/pilgrims/pilgrims').then((m) => m.Pilgrims),
      },
      {
        path: 'pilgrims/:id',
        ...needs(P.Pilgrims),
        loadComponent: () =>
          import('./features/pilgrims/pilgrim-detail/pilgrim-detail').then((m) => m.PilgrimDetail),
      },
      {
        path: 'supervisors',
        ...needs(P.Supervisors),
        loadComponent: () =>
          import('./features/supervisors/supervisors').then((m) => m.Supervisors),
      },
      {
        path: 'supervisors/:id',
        ...needs(P.Supervisors),
        loadComponent: () =>
          import('./features/supervisors/supervisor-detail/supervisor-detail').then((m) => m.SupervisorDetail),
      },
      {
        path: 'tour-leaders',
        ...needs(P.TourLeaders),
        loadComponent: () =>
          import('./features/tour-leaders/tour-leaders').then((m) => m.TourLeaders),
      },
      {
        path: 'tour-groups',
        ...needs(P.TourLeaders),
        loadComponent: () =>
          import('./features/tour-groups/tour-groups').then((m) => m.TourGroups),
      },
      {
        path: 'devices',
        ...needs(P.Devices),
        loadComponent: () =>
          import('./features/devices/devices').then((m) => m.Devices),
      },
      {
        path: 'chat',
        // every company account: the management chat needs no permission (pilgrims / supervisors inside follow CHAT_FIELD_PERMISSIONS)
        loadComponent: () =>
          import('./features/chat/chat').then((m) => m.Chat),
      },
      {
        path: 'reviews',
        ...needs(P.Reviews),
        loadComponent: () =>
          import('./features/reviews/reviews').then((m) => m.Reviews),
      },
      {
        path: 'complaints',
        ...needs(P.Complaints),
        loadComponent: () =>
          import('./features/complaints/complaints').then((m) => m.Complaints),
      },
      {
        path: 'broadcast',
        ...needs(P.Broadcast),
        loadComponent: () =>
          import('./features/broadcast/broadcast').then((m) => m.Broadcast),
      },
      {
        path: 'notifications',
        ...needs(P.Notifications),
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.Notifications),
      },
      {
        path: 'tasks',
        ...needs(P.SupervisorTasks),
        loadComponent: () =>
          import('./features/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'rituals-control',
        ...needs(P.Pilgrims),
        loadComponent: () =>
          import('./features/rituals-control/rituals-control').then((m) => m.RitualsControl),
      },
      {
        path: 'critical-health-cases',
        ...needs(P.Emergencies),
        loadComponent: () =>
          import('./features/critical-health-cases/critical-health-cases').then((m) => m.CriticalHealthCases),
      },
      {
        path: 'jamarat-delegates',
        ...needs(P.Delegates),
        loadComponent: () =>
          import('./features/jamarat-delegates/jamarat-delegates').then((m) => m.JamaratDelegates),
      },
      {
        path: 'accommodation-location',
        ...needs(P.Pilgrims),
        loadComponent: () =>
          import('./features/accommodation-location/accommodation-location').then((m) => m.AccommodationLocation),
      },
      {
        path: 'settings',
        ...adminOnly,
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'staff',
        ...adminOnly,
        loadComponent: () =>
          import('./features/staff/staff').then((m) => m.Staff),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'no-access',
        loadComponent: () =>
          import('./features/no-access/no-access').then((m) => m.NoAccess),
      },
      {
        path: '',
        pathMatch: 'full',
        // the manager keeps the dashboard as the start page; staff start at their first allowed section
        redirectTo: () => {
          const auth = inject(AuthService);
          return auth.isStaff() ? auth.defaultRoute() : '/dashboard';
        },
      },
    ],
  },
  { path: '**', redirectTo: '/auth/login' },
];
