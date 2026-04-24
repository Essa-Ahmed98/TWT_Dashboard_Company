import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { ComplaintsApiData, ComplaintsQuery } from './complaints.model';

@Injectable({ providedIn: 'root' })
export class ComplaintsService {
  private readonly http = inject(HttpClient);

  getComplaints(query: ComplaintsQuery): Observable<ApiResult<ComplaintsApiData>> {
    let params = new HttpParams()
      .set('CompanyId', query.CompanyId)
      .set('PageNumber', String(query.PageNumber))
      .set('PageSize', String(query.PageSize))
      .set('SortBy', String(query.SortBy ?? 0));

    if (query.CampaignId) params = params.set('CampaignId', query.CampaignId);
    if (query.GroupId) params = params.set('GroupId', query.GroupId);

    return this.http.get<ApiResult<ComplaintsApiData>>(`${environment.apiBase}/Complaints`, { params });
  }
}
