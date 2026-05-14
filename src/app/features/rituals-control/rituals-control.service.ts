import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import {
  RitualApiItem,
  RitualsControlCampaignItem,
  RitualsControlGroupItem,
  UpdateGroupRitualProgressPayload,
} from './rituals-control.model';

@Injectable({ providedIn: 'root' })
export class RitualsControlService {
  private readonly http = inject(HttpClient);

  getAllRituals(): Observable<ApiResult<RitualApiItem[]>> {
    return this.http.get<ApiResult<RitualApiItem[]>>(`${environment.apiBase}/Rituals/all`);
  }

  updateGroupRitualProgress(payload: UpdateGroupRitualProgressPayload): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(`${environment.apiBase}/Rituals/group-progress`, payload);
  }

  getCampaigns(companyId: string): Observable<ApiResult<RitualsControlCampaignItem[]>> {
    return this.http.get<ApiResult<RitualsControlCampaignItem[]>>(
      `${environment.apiBase}/Campaigns/all/${companyId}`,
    );
  }

  getGroups(campaignId: string): Observable<ApiResult<RitualsControlGroupItem[]>> {
    return this.http.get<ApiResult<RitualsControlGroupItem[]>>(
      `${environment.apiBase}/Groups/all/${campaignId}`,
    );
  }
}
