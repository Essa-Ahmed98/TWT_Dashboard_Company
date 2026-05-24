import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { TourGroupsPagedResult, TourGroupsQuery } from './tour-groups.model';

@Injectable({ providedIn: 'root' })
export class TourGroupsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/TourGroups`;

  getTourGroups(query: TourGroupsQuery): Observable<ApiResult<TourGroupsPagedResult>> {
    let params = new HttpParams()
      .set('pageNumber', query.pageNumber)
      .set('pageSize', query.pageSize);

    if (query.searchTerm?.trim()) params = params.set('searchTerm', query.searchTerm.trim());
    if (query.sortBy?.trim()) params = params.set('sortBy', query.sortBy.trim());
    if (query.isDescending !== undefined) params = params.set('isDescending', query.isDescending);

    return this.http.get<ApiResult<TourGroupsPagedResult>>(this.base, { params });
  }
}
