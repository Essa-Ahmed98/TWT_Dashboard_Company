import { Injectable, inject, signal } from '@angular/core';
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

  readonly settings = this._settings.asReadonly();
  readonly loading = this._loading.asReadonly();

  loadSettings(): void {
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
