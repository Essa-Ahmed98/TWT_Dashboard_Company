import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { HealthConditionsPage, HealthConditionsQuery } from './critical-health-cases.model';

@Injectable({ providedIn: 'root' })
export class CriticalHealthCasesService {
  private readonly http = inject(HttpClient);

  getHealthConditions(query: HealthConditionsQuery): Observable<ApiResult<HealthConditionsPage>> {
    let params = new HttpParams()
      .set('PageNumber', String(query.PageNumber))
      .set('PageSize', String(query.PageSize));

    if (query.Search?.trim()) params = params.set('Search', query.Search.trim());
    if (query.CompanyId?.trim()) params = params.set('CompanyId', query.CompanyId.trim());
    if (query.CampaignId?.trim()) params = params.set('CampaignId', query.CampaignId.trim());
    if (query.GroupId?.trim()) params = params.set('GroupId', query.GroupId.trim());

    return this.http.get<ApiResult<HealthConditionsPage>>(
      `${environment.apiBase}/HealthConditions`,
      { params },
    );
  }
}
