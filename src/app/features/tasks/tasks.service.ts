import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResult } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';
import { AssignSupervisorTaskRequest, SupervisorTasksData, SupervisorTasksQuery } from './tasks.model';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);

  getAssigned(query: SupervisorTasksQuery): Observable<ApiResult<SupervisorTasksData>> {
    let params = new HttpParams()
      .set('pageNumber', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    if (query.statusFilter !== undefined) {
      params = params.set('statusFilter', String(query.statusFilter));
    }
    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }
    if (query.supervisorId?.trim()) {
      params = params.set('supervisorId', query.supervisorId.trim());
    }

    return this.http.get<ApiResult<SupervisorTasksData>>(
      `${environment.apiBase}/SupervisorTasks/assigned`,
      { params },
    );
  }

  assign(payload: AssignSupervisorTaskRequest): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(`${environment.apiBase}/SupervisorTasks/assign`, payload);
  }
}
