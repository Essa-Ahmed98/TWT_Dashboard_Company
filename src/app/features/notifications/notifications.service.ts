import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';
import { NotificationType, SendNotificationRequest, SentNotificationItem } from './notifications.model';

export interface SentNotificationsQuery {
  Type?: NotificationType;
  PageNumber: number;
  PageSize: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);

  send(payload: SendNotificationRequest): Observable<ApiResult<unknown>> {
    const headers = new HttpHeaders({ 'Accept-Language': 'ar' });
    return this.http.post<ApiResult<unknown>>(`${environment.apiBase}/Notifications/send`, payload, { headers });
  }

  getSent(query: SentNotificationsQuery): Observable<ApiResult<PaginatedResult<SentNotificationItem>>> {
    let params = new HttpParams()
      .set('PageNumber', String(query.PageNumber))
      .set('PageSize', String(query.PageSize));

    if (query.Type !== undefined) params = params.set('Type', String(query.Type));

    const headers = new HttpHeaders({ 'Accept-Language': 'ar' });
    return this.http.get<ApiResult<PaginatedResult<SentNotificationItem>>>(
      `${environment.apiBase}/Notifications/sent`,
      { params, headers },
    );
  }
}
