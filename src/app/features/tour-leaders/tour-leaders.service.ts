import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { TourLeadersPagedResult, TourLeadersQuery } from './tour-leaders.model';

@Injectable({ providedIn: 'root' })
export class TourLeadersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/TourLeaders`;

  getTourLeaders(query: TourLeadersQuery): Observable<ApiResult<TourLeadersPagedResult>> {
    let params = new HttpParams()
      .set('pageNumber', query.pageNumber)
      .set('pageSize', query.pageSize);

    if (query.searchText?.trim()) params = params.set('searchText', query.searchText.trim());
    if (query.sortBy?.trim()) params = params.set('sortBy', query.sortBy.trim());
    if (query.isDescending !== undefined) params = params.set('isDescending', query.isDescending);

    return this.http.get<ApiResult<TourLeadersPagedResult>>(this.base, { params });
  }
}
