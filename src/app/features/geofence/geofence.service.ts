import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';
import {
  CampaignWithGroupsApiItem,
  CreateGeoZoneRequest,
  GeoZoneApiItem,
  GroupPilgrimMapApiItem,
  UpdateGeoZoneRequest,
} from './geofence.model';

@Injectable({ providedIn: 'root' })
export class GeofenceService {
  private readonly http = inject(HttpClient);

  getGeoZones(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Observable<ApiResult<PaginatedResult<GeoZoneApiItem>>> {
    let query = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);

    if (params.search?.trim()) {
      query = query.set('search', params.search.trim());
    }

    return this.http.get<ApiResult<PaginatedResult<GeoZoneApiItem>>>(
      `${environment.apiBase}/GeoZones`,
      { params: query },
    );
  }

  getCampaignsWithGroups(params: {
    page: number;
    pageSize: number;
  }): Observable<ApiResult<PaginatedResult<CampaignWithGroupsApiItem>>> {
    const query = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);

    return this.http.get<ApiResult<PaginatedResult<CampaignWithGroupsApiItem>>>(
      `${environment.apiBase}/GeoZones/campaign-with-groups`,
      { params: query },
    );
  }

  getPilgrimsInGroup(groupId: string): Observable<ApiResult<GroupPilgrimMapApiItem[]>> {
    return this.http.get<ApiResult<GroupPilgrimMapApiItem[]>>(
      `${environment.apiBase}/GeoZones/pilgrims-in-group/${groupId}`,
    );
  }

  createGeoZone(body: CreateGeoZoneRequest): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(
      `${environment.apiBase}/GeoZones`,
      body,
    );
  }

  updateGeoZone(body: UpdateGeoZoneRequest): Observable<ApiResult<unknown>> {
    return this.http.put<ApiResult<unknown>>(
      `${environment.apiBase}/GeoZones`,
      body,
    );
  }

  deleteGeoZone(id: string): Observable<ApiResult<unknown>> {
    return this.http.delete<ApiResult<unknown>>(
      `${environment.apiBase}/GeoZones/${id}`,
    );
  }
}
