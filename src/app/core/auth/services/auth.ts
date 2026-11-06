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
  IsRememberMeChecked: boolean;
  UserRole: number;
}

/** Thrown by login() when the account is valid but is not a company admin. */
export const LOGIN_ROLE_NOT_ALLOWED = 'LOGIN_ROLE_NOT_ALLOWED';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'admin_auth_token';
  private readonly USER_KEY  = 'admin_auth_user';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http      = inject(HttpClient);
  private readonly router    = inject(Router);

  currentUser = signal<StoredUser | null>(this.loadUser());
  isLoggedIn  = signal<boolean>(this.hasToken());

  login(emailOrPhone: string, password: string, rememberMe = false) {
    const body: LoginCommand = {
      EmailOrPhone: emailOrPhone,
      Password: password,
      IsRememberMeChecked: rememberMe,
      UserRole: 3,
    };

    return this.http
      .post<ApiResult<UserLoginResult>>(`${environment.apiBase}/Users/login`, body)
      .pipe(
        map(res => {
          if (!res.IsSuccess) {
            throw new Error(res.Error?.message ?? 'فشل تسجيل الدخول');
          }
          // only company admins may use this dashboard - store nothing for any other role
          if (res.Data?.Role !== 'Admin') {
            throw new Error(LOGIN_ROLE_NOT_ALLOWED);
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
            companyId:   String(value.CompanyId ?? claims['CompanyId'] ?? claims['companyId'] ?? claims['company_id'] ?? ''),
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
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  /** Clears the stored token/user without navigating (used by the guard for an expired token). */
  clearSession(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
  }

  /** True when the JWT has an `exp` claim in the past. Undecodable tokens are not treated as expired. */
  isTokenExpired(token: string | null = this.getToken()): boolean {
    if (!token) return false;
    const exp = Number(this.decodeToken(token)['exp']);
    if (!Number.isFinite(exp) || exp <= 0) return false;
    return exp * 1000 <= Date.now();
  }

  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  updateCurrentUser(patch: Partial<StoredUser>): void {
    const current = this.currentUser();
    if (!current) return;

    const updated = { ...current, ...patch };
    if (this.isBrowser) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
    }
    this.currentUser.set(updated);
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
    if (!this.isBrowser) return false;
    const token = localStorage.getItem(this.TOKEN_KEY);
    return !!token && !this.isTokenExpired(token);
  }

  private loadUser(): StoredUser | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredUser; }
    catch { return null; }
  }
}
