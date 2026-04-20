import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { AuthService } from '../../core/auth/services/auth';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  auth = inject(AuthService);
  toggleSidenav = output<void>();
}
