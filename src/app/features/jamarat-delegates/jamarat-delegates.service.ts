import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import {
  DelegateListItem,
  DelegatesPagedResult,
  DelegatesQuery,
  PilgrimRequestsResult,
} from './jamarat-delegates.model';

@Injectable({ providedIn: 'root' })
export class JamaratDelegatesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/Delegates`;

  getDelegates(query: DelegatesQuery): Observable<ApiResult<DelegatesPagedResult>> {
    let params = new HttpParams()
      .set('pageNumber', query.pageNumber)
      .set('pageSize', query.pageSize);

    if (query.searchText?.trim()) params = params.set('searchText', query.searchText.trim());
    if (query.affiliation?.trim()) params = params.set('affiliation', query.affiliation.trim());

    return this.http.get<ApiResult<DelegatesPagedResult>>(this.base, { params });
  }

  getDelegateById(id: string): Observable<ApiResult<DelegateListItem>> {
    return this.http.get<ApiResult<DelegateListItem>>(`${this.base}/${id}`);
  }

  createDelegate(formData: FormData): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(this.base, formData);
  }

  updateDelegate(id: string, formData: FormData): Observable<ApiResult<unknown>> {
    return this.http.put<ApiResult<unknown>>(`${this.base}/${id}`, formData);
  }

  getRequests(filterType?: string): Observable<ApiResult<PilgrimRequestsResult>> {
    let params = new HttpParams();
    if (filterType?.trim()) params = params.set('filterType', filterType.trim());
    return this.http.get<ApiResult<PilgrimRequestsResult>>(`${this.base}/requests`, { params });
  }
}
