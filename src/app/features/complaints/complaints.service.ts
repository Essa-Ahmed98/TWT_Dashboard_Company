import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import {
  CampaignDropdownItem,
  ComplaintStatus,
  ComplaintsQuery,
  ComplaintsResponseData,
  GroupDropdownItem,
  SupervisorDropdownItem,
} from './complaints.model';

@Injectable({ providedIn: 'root' })
export class ComplaintsService {
  private readonly http = inject(HttpClient);

  getComplaints(query: ComplaintsQuery): Observable<ApiResult<ComplaintsResponseData>> {
    let params = new HttpParams()
      .set('PageNumber', String(query.PageNumber))
      .set('PageSize', String(query.PageSize));

    if (query.CompanyId) params = params.set('CompanyId', query.CompanyId);
    if (query.CampaignId) params = params.set('CampaignId', query.CampaignId);
    if (query.GroupId) params = params.set('GroupId', query.GroupId);
    if (query.SupervisorId) params = params.set('SupervisorId', query.SupervisorId);
    if (query.StatusFilter !== undefined && query.StatusFilter !== null) {
      params = params.set('StatusFilter', String(query.StatusFilter));
    }

    return this.http.get<ApiResult<ComplaintsResponseData>>(`${environment.apiBase}/Complaints`, { params });
  }

  getCampaigns(companyId: string): Observable<ApiResult<CampaignDropdownItem[]>> {
    return this.http.get<ApiResult<CampaignDropdownItem[]>>(
      `${environment.apiBase}/Campaigns/all/${companyId}`,
    );
  }

  getGroups(campaignId: string): Observable<ApiResult<PaginatedResult<GroupDropdownItem>>> {
    const params = new HttpParams()
      .set('CampaignId', campaignId)
      .set('PageNumber', '1')
      .set('PageSize', '500');
    return this.http.get<ApiResult<PaginatedResult<GroupDropdownItem>>>(
      `${environment.apiBase}/Groups`, { params },
    );
  }

  assignSupervisor(complaintId: string, supervisorId: string): Observable<ApiResult<unknown>> {
    const params = new HttpParams().set('supervisorId', supervisorId);
    return this.http.put<ApiResult<unknown>>(
      `${environment.apiBase}/Complaints/${complaintId}/assign`,
      null,
      { params },
    );
  }

  updateStatus(complaintId: string, status: ComplaintStatus): Observable<ApiResult<unknown>> {
    const params = new HttpParams().set('status', String(status));
    return this.http.put<ApiResult<unknown>>(
      `${environment.apiBase}/Complaints/${complaintId}/status`,
      null,
      { params },
    );
  }

  getSupervisors(groupId: string, companyId: string, search?: string): Observable<ApiResult<SupervisorDropdownItem[]>> {
    let params = new HttpParams().set('pageSize', '10').set('groupId', groupId).set('companyId', companyId);
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<ApiResult<SupervisorDropdownItem[]>>(
      `${environment.apiBase}/Supervisors/all`,
      { params },
    );
  }
}
