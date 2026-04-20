import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResult } from '../../models/api.models';
import { UserLoginResult, StoredUser } from '../../models/user.model';

interface LoginCommand {
  EmailOrPhone: string;
  Password: string;
  UserRole: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http      = inject(HttpClient);
  private readonly router    = inject(Router);

  currentUser = signal<StoredUser | null>(this.loadUser());
  isLoggedIn  = signal<boolean>(this.hasToken());

  login(emailOrPhone: string, password: string) {
    const body: LoginCommand = {
      EmailOrPhone: emailOrPhone,
      Password: password,
      UserRole: 3,
    };

    return this.http
      .post<ApiResult<UserLoginResult>>(`${environment.apiBase}/Users/login`, body)
      .pipe(
        map(res => {
          if (!res.IsSuccess) {
            throw new Error(res.Error?.message ?? 'فشل تسجيل الدخول');
          }
          return res.Data;
        }),
        tap(value => {
          const claims  = this.decodeToken(value.Token);
          const user: StoredUser = {
            userId:      value.Id,
            displayName: value.DisplayName,
            email:       value.Email,
            role:        value.Role,
            companyId:   String(claims['CompanyId'] ?? claims['companyId'] ?? claims['company_id'] ?? ''),
          };
          if (this.isBrowser) {
            localStorage.setItem(this.TOKEN_KEY, value.Token);
            localStorage.setItem(this.USER_KEY,  JSON.stringify(user));
          }
          this.currentUser.set(user);
          this.isLoggedIn.set(true);
        })
      );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  private decodeToken(token: string): Record<string, unknown> {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return {};
    }
  }

  private hasToken(): boolean {
    return this.isBrowser ? !!localStorage.getItem(this.TOKEN_KEY) : false;
  }

  private loadUser(): StoredUser | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredUser; }
    catch { return null; }
  }
}
