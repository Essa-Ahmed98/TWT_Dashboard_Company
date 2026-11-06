import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/services/auth';

/** A staff account that was given no section at all (or not yet) lands here instead of an error */
@Component({
  selector: 'app-no-access',
  imports: [RouterLink, TranslateModule],
  template: `
    <div class="no-access">
      <i class="pi pi-lock no-access__icon"></i>
      <h1>{{ 'NO_ACCESS.TITLE' | translate }}</h1>
      <p>{{ 'NO_ACCESS.TEXT' | translate }}</p>
      <div class="no-access__actions">
        <a class="btn btn--outline" routerLink="/profile">{{ 'SIDENAV.PROFILE' | translate }}</a>
        <button class="btn btn--primary" (click)="auth.logout()">{{ 'HEADER.LOGOUT' | translate }}</button>
      </div>
    </div>
  `,
  styles: `
    .no-access {
      max-width: 460px;
      margin: 8vh auto 0;
      padding: 32px 24px;
      background: #fff;
      border: 1px solid #e9edf2;
      border-radius: 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .no-access__icon { font-size: 36px; color: #0b405b; }
    h1 { margin: 0; font-size: 20px; color: #1a2e3b; }
    p { margin: 0; font-size: 14px; color: #6c7a89; line-height: 1.7; }
    .no-access__actions { display: flex; gap: 10px; margin-top: 10px; }
    .btn {
      display: inline-flex; align-items: center; height: 38px; padding: 0 16px; border-radius: 8px;
      font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; text-decoration: none;
      border: 1px solid transparent;
    }
    .btn--primary { background: #0b405b; color: #fff; }
    .btn--outline { background: transparent; color: #1a2e3b; border-color: #e9edf2; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAccess {
  readonly auth = inject(AuthService);
}
