import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { AuthService } from '../../core/auth/services/auth';
import { CompanySettingsApiItem, UpdateCompanySettingsRequest } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _settings = signal<CompanySettingsApiItem | null>(null);
  private readonly _loading = signal(false);
  private lastCompanyId: string | null = this.auth.currentUser()?.companyId ?? null;

  constructor() {
    // drop the cached settings on logout or when another company logs in
    effect(() => {
      const companyId = this.auth.currentUser()?.companyId ?? null;
      if (companyId === this.lastCompanyId) return;
      this.lastCompanyId = companyId;
      untracked(() => this._settings.set(null));
    });
  }

  readonly settings = this._settings.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly iconUrl = computed(() => {
    const path = this._settings()?.IconPath;
    if (!path?.trim()) return '';
    const trimmed = path.trim();
    if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
    const base = environment.uploadsBase.replace(/\/$/, '');
    const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${base}${relativePath}`;
  });

  loadSettings(): void {
    if (this._settings() || this._loading()) return;
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this._loading.set(true);
    this.http
      .get<ApiResult<CompanySettingsApiItem>>(
        `${environment.apiBase}/companies/${companyId}/settings`
      )
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this._settings.set(res.Data);
        },
      });
  }

  setSettings(settings: CompanySettingsApiItem): void {
    this._settings.set(settings);
  }

  updateSettings(payload: UpdateCompanySettingsRequest): Observable<ApiResult<CompanySettingsApiItem>> | null {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return null;

    const formData = new FormData();
    formData.append('HealthEnabled', String(payload.HealthEnabled));
    formData.append('LocationEnabled', String(payload.LocationEnabled));
    formData.append('DocumentsEnabled', String(payload.DocumentsEnabled));
    formData.append('RitualsEnabled', String(payload.RitualsEnabled));
    formData.append('ReviewsEnabled', String(payload.ReviewsEnabled));
    formData.append('ComplaintsEnabled', String(payload.ComplaintsEnabled));
    formData.append('TransportationEnabled', String(payload.TransportationEnabled));
    formData.append('CommunicationEnabled', String(payload.CommunicationEnabled));

    if (payload.Icon) {
      formData.append('Icon', payload.Icon);
    }

    return this.http.put<ApiResult<CompanySettingsApiItem>>(
      `${environment.apiBase}/companies/${companyId}/settings`,
      formData
    );
  }
}
