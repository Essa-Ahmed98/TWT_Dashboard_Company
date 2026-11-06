import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/services/auth';
import { CAMPAIGN_PAGE_PERMISSIONS, PERMISSIONS as P, PermissionRule } from '../../core/auth/permissions';
import { SettingsService } from '../../features/settings/settings.service';

export interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  /** staff need this permission (any one of a list); the company manager sees every item */
  permission?: PermissionRule;
  /** only the company manager (staff management, company settings) */
  adminOnly?: boolean;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidenav',
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidenav implements OnInit {
  collapsed = input(false);
  readonly auth = inject(AuthService);
  readonly settingsService = inject(SettingsService);

  ngOnInit(): void {
    this.settingsService.loadSettings();
  }

  readonly navGroups: NavGroup[] = [
    {
      labelKey: 'SIDENAV.MAIN_MENU',
      items: [
        { labelKey: 'SIDENAV.DASHBOARD',         icon: 'pi pi-th-large',   route: '/dashboard',              permission: P.Dashboards },
        { labelKey: 'SIDENAV.CENTERS',           icon: 'pi pi-globe',      route: '/campaigns',              permission: CAMPAIGN_PAGE_PERMISSIONS },
        { labelKey: 'SIDENAV.DISPATCH',          icon: 'pi pi-car',        route: '/dispatch',               permission: P.Buses },
        { labelKey: 'SIDENAV.GEOFENCE',          icon: 'pi pi-map-marker', route: '/geo-fence',              permission: P.GeoZones },
        { labelKey: 'SIDENAV.RITUALS_CONTROL',   icon: 'pi pi-list-check', route: '/rituals-control',        permission: P.Pilgrims },
        { labelKey: 'SIDENAV.CRITICAL_HEALTH',   icon: 'pi pi-heart',      route: '/critical-health-cases',  permission: P.Emergencies },
        { labelKey: 'SIDENAV.JAMARAT_DELEGATES', icon: 'pi pi-user-edit',  route: '/jamarat-delegates',      permission: P.Delegates },
        { labelKey: 'SIDENAV.ACCOMMODATION',     icon: 'pi pi-home',       route: '/accommodation-location', permission: P.Pilgrims },
      ],
    },
    {
      labelKey: 'SIDENAV.PERSONNEL',
      items: [
        { labelKey: 'SIDENAV.PILGRIMS',     icon: 'pi pi-users',     route: '/pilgrims',     permission: P.Pilgrims },
        { labelKey: 'SIDENAV.SUPERVISORS',  icon: 'pi pi-user',      route: '/supervisors',  permission: P.Supervisors },
        { labelKey: 'SIDENAV.TOUR_LEADERS', icon: 'pi pi-user-edit', route: '/tour-leaders', permission: P.TourLeaders },
        { labelKey: 'SIDENAV.TOUR_GROUPS',  icon: 'pi pi-list',      route: '/tour-groups',  permission: P.TourLeaders },
        { labelKey: 'SIDENAV.DEVICES',      icon: 'pi pi-mobile',    route: '/devices',      permission: P.Devices },
      ],
    },
    {
      labelKey: 'SIDENAV.TOOLS',
      items: [
        { labelKey: 'SIDENAV.CHAT',          icon: 'pi pi-comments',           route: '/chat' },   // management chat: every account
        { labelKey: 'SIDENAV.TASKS',         icon: 'pi pi-briefcase',          route: '/tasks',         permission: P.SupervisorTasks },
        { labelKey: 'SIDENAV.NOTIFICATIONS', icon: 'pi pi-bell',               route: '/notifications', permission: P.Notifications },
        { labelKey: 'SIDENAV.BROADCAST',     icon: 'pi pi-send',               route: '/broadcast',     permission: P.Broadcast },
        { labelKey: 'SIDENAV.REVIEWS',       icon: 'pi pi-star',               route: '/reviews',       permission: P.Reviews },
        { labelKey: 'SIDENAV.COMPLAINTS',    icon: 'pi pi-exclamation-circle', route: '/complaints',    permission: P.Complaints },
        { labelKey: 'SIDENAV.STAFF',         icon: 'pi pi-id-card',            route: '/staff',         adminOnly: true },
        { labelKey: 'SIDENAV.PROFILE',       icon: 'pi pi-user-plus',          route: '/profile' },
        { labelKey: 'SIDENAV.SETTINGS',      icon: 'pi pi-cog',                route: '/settings',      adminOnly: true },
      ],
    },
  ];

  /** Items the signed-in user may open; groups left empty are hidden */
  readonly visibleGroups = computed<NavGroup[]>(() => {
    this.auth.currentUser(); // re-evaluate when another account logs in
    return this.navGroups
      .map(group => ({ ...group, items: group.items.filter(item => this.canSee(item)) }))
      .filter(group => group.items.length > 0);
  });

  private canSee(item: NavItem): boolean {
    if (item.adminOnly) return this.auth.isAdmin();
    return this.auth.hasPermission(item.permission);
  }
}
