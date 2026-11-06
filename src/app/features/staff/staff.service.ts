import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { CreateStaffPayload, StaffMember, UpdateStaffPayload } from './staff.model';

/** The company manager's staff accounts. Every endpoint is for the manager (role Admin) only. */
@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/Users`;

  getStaff(): Observable<ApiResult<StaffMember[]>> {
    return this.http.get<ApiResult<StaffMember[]>>(`${this.base}/specific`);
  }

  createStaff(payload: CreateStaffPayload): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(`${this.base}/specific`, payload);
  }

  updateStaff(payload: UpdateStaffPayload): Observable<ApiResult<unknown>> {
    return this.http.put<ApiResult<unknown>>(`${this.base}/permissions`, payload);
  }

  setStatus(userId: string, status: number): Observable<ApiResult<unknown>> {
    return this.http.put<ApiResult<unknown>>(`${this.base}/status`, { UserId: userId, Status: status });
  }
}
