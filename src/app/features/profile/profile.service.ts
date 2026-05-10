import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { ResetPasswordRequest, UpdateUserProfileRequest, UserProfile } from './profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  getUserInfo(): Observable<ApiResult<UserProfile>> {
    return this.http.get<ApiResult<UserProfile>>(`${environment.apiBase}/Users/info`);
  }

  updateUserProfile(payload: UpdateUserProfileRequest): Observable<ApiResult<unknown>> {
    return this.http.put<ApiResult<unknown>>(`${environment.apiBase}/Users`, payload);
  }

  uploadUserImage(userId: string, image: File): Observable<ApiResult<unknown>> {
    const formData = new FormData();
    formData.append('image', image);

    return this.http.post<ApiResult<unknown>>(
      `${environment.apiBase}/Users/${userId}/upload-user-image`,
      formData
    );
  }

  resetPassword(payload: ResetPasswordRequest): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(`${environment.apiBase}/Users/reset-password`, payload);
  }
}
