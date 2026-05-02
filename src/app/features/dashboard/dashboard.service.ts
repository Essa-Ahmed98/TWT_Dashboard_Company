import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { DashboardStats, HealthDistribution } from './dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  private readonly _stats          = signal<DashboardStats | null>(null);
  private readonly _loading        = signal(false);
  private readonly _health         = signal<HealthDistribution | null>(null);
  private readonly _healthLoading  = signal(false);

  readonly stats         = this._stats.asReadonly();
  readonly loading       = this._loading.asReadonly();
  readonly health        = this._health.asReadonly();
  readonly healthLoading = this._healthLoading.asReadonly();

  load(): void {
    this._loading.set(true);
    this.http
      .get<ApiResult<DashboardStats>>(`${environment.apiBase}/Dashboards/admin`)
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) this._stats.set(res.Data);
      });
  }

  loadHealth(): void {
    this._healthLoading.set(true);
    this.http
      .get<ApiResult<HealthDistribution>>(`${environment.apiBase}/Dashboards/admin/health-condition-distribution`)
      .pipe(finalize(() => this._healthLoading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) this._health.set(res.Data);
      });
  }
}
