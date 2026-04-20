import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/services/auth';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidenav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidenav {
  collapsed = input(false);
  readonly auth = inject(AuthService);

  navGroups: NavGroup[] = [
    {
      label: 'القائمة الرئيسية',
      items: [
        { label: 'لوحة التحكم', icon: 'pi pi-th-large', route: '/dashboard' },
        { label: 'إدارة الحملات', icon: 'pi pi-globe', route: '/campaigns' },
        { label: 'إدارة التفويج والنقل', icon: 'pi pi-car', route: '/dispatch' },
        { label: 'غرفة المراقبة', icon: 'pi pi-map-marker', route: '/geo-fence' },
      ],
    },
    {
      label: 'إدارة الأفراد',
      items: [
        { label: 'إدارة الحجاج', icon: 'pi pi-users', route: '/pilgrims' },
        { label: 'إدارة المشرفين', icon: 'pi pi-user', route: '/supervisors' },
        { label: 'إدارة الأجهزة', icon: 'pi pi-mobile', route: '/devices' },
      ],
    },
    {
      label: 'أدوات',
      items: [
        { label: 'الدردشة', icon: 'pi pi-comments', route: '/chat' },
        { label: 'التقييمات', icon: 'pi pi-star', route: '/reviews' },
      ],
    },
  ];
}
