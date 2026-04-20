import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { DeviceItem, CreateDeviceRequest, UpdateDeviceRequest, UpdateDeviceConnectionRequest, PilgrimOption } from './devices.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DevicesService {
  private readonly http = inject(HttpClient);

  getDevices(params: {
    pageNumber: number;
    pageSize:   number;
    search?:    string;
  }): Observable<ApiResult<PaginatedResult<DeviceItem>>> {
    let p = new HttpParams()
      .set('PageNumber', params.pageNumber)
      .set('PageSize',   params.pageSize);

    if (params.search?.trim()) {
      p = p.set('Search', params.search.trim());
    }

    return this.http.get<ApiResult<PaginatedResult<DeviceItem>>>(
      `${environment.apiBase}/Devices`,
      { params: p },
    );
  }

  addDevice(body: CreateDeviceRequest): Observable<ApiResult<DeviceItem>> {
    return this.http.post<ApiResult<DeviceItem>>(
      `${environment.apiBase}/Devices`,
      body,
    );
  }

  updateDevice(body: UpdateDeviceRequest): Observable<ApiResult<DeviceItem>> {
    return this.http.put<ApiResult<DeviceItem>>(
      `${environment.apiBase}/Devices`,
      body,
    );
  }

  deleteDevice(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${environment.apiBase}/Devices/${id}`,
    );
  }

  updateDeviceConnection(body: UpdateDeviceConnectionRequest): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${environment.apiBase}/Devices/update-device-connection`,
      body,
    );
  }

  getAllPilgrims(companyId: string): Observable<ApiResult<PilgrimOption[]>> {
    return this.http.get<ApiResult<PilgrimOption[]>>(
      `${environment.apiBase}/Pilgrims/all/${companyId}`,
    );
  }

  downloadTemplate(language = 'ar'): Observable<HttpResponse<Blob>> {
    const headers = new HttpHeaders({
      'Accept-Language': language,
    });

    return this.http.get(`${environment.apiBase}/Devices/template`, {
      headers,
      responseType: 'blob',
      observe: 'response',
    });
  }

  uploadDevicesFile(file: File, language = 'ar'): Observable<ApiResult<unknown> | { issuccess?: boolean; IsSuccess?: boolean }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers = new HttpHeaders({
      'Accept-Language': language,
    });

    return this.http.post<ApiResult<unknown> | { issuccess?: boolean; IsSuccess?: boolean }>(
      `${environment.apiBase}/Devices/upload`,
      formData,
      { headers },
    );
  }
}
