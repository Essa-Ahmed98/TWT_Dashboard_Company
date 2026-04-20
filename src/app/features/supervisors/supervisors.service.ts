import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { CreateSupervisorRequest, PilgrimGroupItem, PilgrimGroupQuery, SupervisorDetailApiItem, SupervisorReviewsApiData, SupervisorsPageData, SupervisorsQuery } from './supervisors.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupervisorsService {
  private readonly http = inject(HttpClient);

  createSupervisor(req: CreateSupervisorRequest): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(`${environment.apiBase}/Supervisors`, req);
  }

  getSupervisorById(id: string): Observable<ApiResult<SupervisorDetailApiItem>> {
    return this.http.get<ApiResult<SupervisorDetailApiItem>>(`${environment.apiBase}/Supervisors/${id}`);
  }

  getSupervisors(query: SupervisorsQuery): Observable<ApiResult<SupervisorsPageData>> {
    let p = new HttpParams()
      .set('PageNumber', query.pageNumber)
      .set('PageSize',   query.pageSize);

    if (query.search?.trim()) {
      p = p.set('Search', query.search.trim());
    }
    if (query.sortBy != null) {
      p = p.set('SortBy', query.sortBy);
    }
    if (query.status != null) {
      p = p.set('Status', query.status);
    }

    return this.http.get<ApiResult<SupervisorsPageData>>(
      `${environment.apiBase}/Supervisors`,
      { params: p },
    );
  }

  getPilgrimsByGroup(query: PilgrimGroupQuery): Observable<ApiResult<PaginatedResult<PilgrimGroupItem>>> {
    let p = new HttpParams()
      .set('GroupId',    query.groupId)
      .set('PageNumber', query.pageNumber)
      .set('PageSize',   query.pageSize);

    if (query.search?.trim()) {
      p = p.set('Search', query.search.trim());
    }

    return this.http.get<ApiResult<PaginatedResult<PilgrimGroupItem>>>(
      `${environment.apiBase}/Pilgrims/group`,
      { params: p },
    );
  }

  getSupervisorReviews(groupId: string): Observable<ApiResult<SupervisorReviewsApiData>> {
    const params = new HttpParams()
      .set('GroupId', groupId)
      .set('PageNumber', 1)
      .set('PageSize', 10);

    const headers = new HttpHeaders({
      'Accept-Language': 'ar',
    });

    return this.http.get<ApiResult<SupervisorReviewsApiData>>(
      `${environment.apiBase}/Reviews/supervisor`,
      { params, headers },
    );
  }
}
