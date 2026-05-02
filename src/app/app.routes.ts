import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth-guard';
import { noAuthGuard } from './core/auth/guards/no-auth-guard';

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
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./features/campaigns/campaigns').then((m) => m.Campaigns),
      },
      {
        path: 'campaigns/:id',
        loadComponent: () =>
          import('./features/campaigns/campaign-detail/campaign-detail').then((m) => m.CampaignDetail),
      },
      {
        path: 'geo-fence',
        loadComponent: () =>
          import('./features/geofence/geofence').then((m) => m.Geofence),
      },
      {
        path: 'dispatch',
        loadComponent: () =>
          import('./features/dispatch/dispatch').then((m) => m.Dispatch),
      },
      {
        path: 'pilgrims',
        loadComponent: () =>
          import('./features/pilgrims/pilgrims').then((m) => m.Pilgrims),
      },
      {
        path: 'pilgrims/:id',
        loadComponent: () =>
          import('./features/pilgrims/pilgrim-detail/pilgrim-detail').then((m) => m.PilgrimDetail),
      },
      {
        path: 'supervisors',
        loadComponent: () =>
          import('./features/supervisors/supervisors').then((m) => m.Supervisors),
      },
      {
        path: 'supervisors/:id',
        loadComponent: () =>
          import('./features/supervisors/supervisor-detail/supervisor-detail').then((m) => m.SupervisorDetail),
      },
      {
        path: 'devices',
        loadComponent: () =>
          import('./features/devices/devices').then((m) => m.Devices),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat').then((m) => m.Chat),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./features/reviews/reviews').then((m) => m.Reviews),
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./features/complaints/complaints').then((m) => m.Complaints),
      },
      {
        path: 'broadcast',
        loadComponent: () =>
          import('./features/broadcast/broadcast').then((m) => m.Broadcast),
      },
      {
        path: 'accommodation-location',
        loadComponent: () =>
          import('./features/accommodation-location/accommodation-location').then((m) => m.AccommodationLocation),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.Settings),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/auth/login' },
];
