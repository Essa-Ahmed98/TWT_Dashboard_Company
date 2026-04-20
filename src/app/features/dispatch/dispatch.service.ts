import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import {
  CreateTransportationScheduleRequest,
  TransportationScheduleApiItem,
  TransportationSchedulesQuery,
} from './dispatch.model';

@Injectable({ providedIn: 'root' })
export class DispatchService {
  private readonly http = inject(HttpClient);

  getSchedules(query: TransportationSchedulesQuery): Observable<ApiResult<PaginatedResult<TransportationScheduleApiItem>>> {
    let params = new HttpParams()
      .set('CompanyId', query.CompanyId)
      .set('PageNumber', String(query.PageNumber))
      .set('PageSize', String(query.PageSize));

    if (query.CampaignId) params = params.set('CampaignId', query.CampaignId);
    if (query.GroupId) params = params.set('GroupId', query.GroupId);
    if (query.BusId) params = params.set('BusId', query.BusId);
    if (query.Search?.trim()) params = params.set('Search', query.Search.trim());

    return this.http.get<ApiResult<PaginatedResult<TransportationScheduleApiItem>>>(
      `${environment.apiBase}/TransportationSchedules`,
      { params },
    );
  }

  createSchedule(body: CreateTransportationScheduleRequest): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${environment.apiBase}/TransportationSchedules`, body);
  }
}
