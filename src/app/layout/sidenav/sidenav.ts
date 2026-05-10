import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/services/auth';
import { SettingsService } from '../../features/settings/settings.service';

export interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
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

  navGroups: NavGroup[] = [
    {
      labelKey: 'SIDENAV.MAIN_MENU',
      items: [
        { labelKey: 'SIDENAV.DASHBOARD',    icon: 'pi pi-th-large',          route: '/dashboard' },
        { labelKey: 'SIDENAV.CENTERS',      icon: 'pi pi-globe',             route: '/campaigns' },
        { labelKey: 'SIDENAV.DISPATCH',     icon: 'pi pi-car',               route: '/dispatch' },
        { labelKey: 'SIDENAV.GEOFENCE',     icon: 'pi pi-map-marker',        route: '/geo-fence' },
        { labelKey: 'SIDENAV.ACCOMMODATION',icon: 'pi pi-home',              route: '/accommodation-location' },
      ],
    },
    {
      labelKey: 'SIDENAV.PERSONNEL',
      items: [
        { labelKey: 'SIDENAV.PILGRIMS',    icon: 'pi pi-users',   route: '/pilgrims' },
        { labelKey: 'SIDENAV.SUPERVISORS', icon: 'pi pi-user',    route: '/supervisors' },
        { labelKey: 'SIDENAV.DEVICES',     icon: 'pi pi-mobile',  route: '/devices' },
      ],
    },
    {
      labelKey: 'SIDENAV.TOOLS',
      items: [
        { labelKey: 'SIDENAV.CHAT',          icon: 'pi pi-comments',           route: '/chat' },
        { labelKey: 'SIDENAV.TASKS',         icon: 'pi pi-briefcase',          route: '/tasks' },
        { labelKey: 'SIDENAV.NOTIFICATIONS', icon: 'pi pi-bell',               route: '/notifications' },
        { labelKey: 'SIDENAV.BROADCAST',     icon: 'pi pi-send',               route: '/broadcast' },
        { labelKey: 'SIDENAV.REVIEWS',       icon: 'pi pi-star',               route: '/reviews' },
        { labelKey: 'SIDENAV.COMPLAINTS',    icon: 'pi pi-exclamation-circle', route: '/complaints' },
        { labelKey: 'SIDENAV.PROFILE',       icon: 'pi pi-user-plus',          route: '/profile' },
        { labelKey: 'SIDENAV.SETTINGS',      icon: 'pi pi-cog',                route: '/settings' },
      ],
    },
  ];
}
