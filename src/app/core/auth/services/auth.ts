import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResult } from '../../models/api.models';
import { UserLoginResult, StoredUser } from '../../models/user.model';
import { PermissionRule, STAFF_LANDING_ROUTES } from '../permissions';

interface LoginCommand {
  EmailOrPhone: string;
  Password: string;
  IsRememberMeChecked: boolean;
  UserRole: number;
}

/** Thrown by login() when the account is valid but is not a company admin or company staff. */
export const LOGIN_ROLE_NOT_ALLOWED = 'LOGIN_ROLE_NOT_ALLOWED';

/** Shown to a staff member who has no section at all */
export const NO_ACCESS_ROUTE = '/no-access';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'admin_auth_token';
  private readonly USER_KEY  = 'admin_auth_user';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly http      = inject(HttpClient);
  private readonly router    = inject(Router);

  currentUser = signal<StoredUser | null>(this.loadUser());
  isLoggedIn  = signal<boolean>(this.hasToken());

  /** The company manager: every section, plus staff management and company settings */
  readonly isAdmin = computed(() => this.currentUser()?.role === 'Admin');

  /** A company staff account (role Specific): only the sections it was given */
  readonly isStaff = computed(() => {
    const user = this.currentUser();
    return user?.role === 'Specific' && !!user.companyId;
  });

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
          // only the company manager and the company's staff may use this dashboard - store nothing for any other role
          const data = res.Data;
          const companyId = data ? this.companyIdOf(data) : '';
          const allowed = data?.Role === 'Admin' || (data?.Role === 'Specific' && !!companyId);
          if (!allowed) {
            throw new Error(LOGIN_ROLE_NOT_ALLOWED);
          }
          return data;
        }),
        tap(value => {
          const user: StoredUser = {
            userId:      value.Id,
            displayName: value.DisplayName,
            email:       value.Email,
            role:        value.Role,
            companyId:   this.companyIdOf(value),
            permissions: value.Role === 'Specific' ? [...(value.Permissions ?? [])] : [],
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

  /** A stored session this dashboard accepts: the company manager, or staff of a company */
  isCompanyUser(): boolean {
    return this.isAdmin() || this.isStaff();
  }

  /** The manager may use everything; staff only what they were given (any one permission of a list is enough) */
  hasPermission(rule: PermissionRule | null | undefined): boolean {
    if (this.isAdmin()) return true;
    if (!this.isStaff()) return false;
    if (!rule || (Array.isArray(rule) && rule.length === 0)) return true;

    const granted = this.currentUser()?.permissions ?? [];
    const needed: readonly string[] = typeof rule === 'string' ? [rule] : rule;
    return needed.some(permission => granted.includes(permission));
  }

  /**
   * Where to go after login, or when a page cannot be opened: the manager keeps the old start page,
   * staff go to the first section they may use (or the "no access" page).
   */
  defaultRoute(): string {
    if (this.isAdmin()) return '/campaigns';
    const first = STAFF_LANDING_ROUTES.find(item => this.hasPermission(item.permission));
    return first?.route ?? NO_ACCESS_ROUTE;
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

  private companyIdOf(value: UserLoginResult): string {
    const claims = this.decodeToken(value.Token);
    return String(value.CompanyId || claims['CompanyId'] || claims['companyId'] || claims['company_id'] || '');
  }

  private decodeToken(token: string | null | undefined): Record<string, unknown> {
    try {
      const payload = (token ?? '').split('.')[1];
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
