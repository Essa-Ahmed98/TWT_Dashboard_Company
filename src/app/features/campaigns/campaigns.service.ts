import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, map, shareReplay, take, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { AuthService } from '../../core/auth/services/auth';
import {
  Campaign, CampaignStatus,
  CampaignApiItem, CampaignsApiData,
  GroupApiItem, BusApiItem, BusForm,
} from './campaigns.model';

export interface CampaignsQuery {
  Search?:     string;
  PageNumber?: number;
  PageSize?:   number;
}

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _campaigns       = signal<Campaign[]>([]);
  private readonly _loading         = signal(false);
  private readonly _totalCount      = signal(0);
  private readonly _totalPages      = signal(0);
  private readonly _currentPage     = signal(1);
  private readonly _pageSize        = signal(10);
  private readonly _currentCampaign = signal<Campaign | null>(null);
  private readonly _detailLoading   = signal(false);
  private readonly _groups             = signal<GroupApiItem[]>([]);
  private readonly _groupsLoading      = signal(false);
  private readonly _groupsTotalPages   = signal(0);
  private readonly _groupsCurrentPage  = signal(1);
  private readonly _groupsTotalCount   = signal(0);
  private readonly _buses              = signal<BusApiItem[]>([]);
  private readonly _busesLoading       = signal(false);
  private readonly _busesTotalPages    = signal(0);
  private readonly _busesCurrentPage   = signal(1);
  private readonly _busesTotalCount    = signal(0);

  readonly campaigns          = this._campaigns.asReadonly();
  readonly loading            = this._loading.asReadonly();
  readonly totalCount         = this._totalCount.asReadonly();
  readonly totalPages         = this._totalPages.asReadonly();
  readonly currentPage        = this._currentPage.asReadonly();
  readonly pageSize           = this._pageSize.asReadonly();
  readonly currentCampaign    = this._currentCampaign.asReadonly();
  readonly detailLoading      = this._detailLoading.asReadonly();
  readonly groups             = this._groups.asReadonly();
  readonly groupsLoading      = this._groupsLoading.asReadonly();
  readonly groupsTotalPages   = this._groupsTotalPages.asReadonly();
  readonly groupsCurrentPage  = this._groupsCurrentPage.asReadonly();
  readonly groupsTotalCount   = this._groupsTotalCount.asReadonly();
  readonly buses              = this._buses.asReadonly();
  readonly busesLoading       = this._busesLoading.asReadonly();
  readonly busesTotalPages    = this._busesTotalPages.asReadonly();
  readonly busesCurrentPage   = this._busesCurrentPage.asReadonly();
  readonly busesTotalCount    = this._busesTotalCount.asReadonly();

  // ── Campaigns/all cache (shared across components) ────────────
  private _allCampaignsCache: Observable<CampaignApiItem[]> | null = null;

  getAllCampaigns(companyId: string): Observable<CampaignApiItem[]> {
    if (!this._allCampaignsCache) {
      this._allCampaignsCache = this.http
        .get<ApiResult<CampaignApiItem[]>>(`${environment.apiBase}/Campaigns/all/${companyId}`)
        .pipe(
          map(res => res.IsSuccess ? res.Data : []),
          shareReplay(1),
        );
    }
    return this._allCampaignsCache;
  }

  clearCurrentCampaign(): void {
    this._currentCampaign.set(null);
  }

  // ── Campaigns list ────────────────────────────────────────────
  loadCampaigns(query: CampaignsQuery = {}): void {
    const page = query.PageNumber ?? 1;
    const size = query.PageSize   ?? 10;

    let params = new HttpParams()
      .set('PageNumber', String(page))
      .set('PageSize',   String(size));

    if (query.Search) params = params.set('Search', query.Search);

    const companyId = this.auth.currentUser()?.companyId;
    if (companyId) params = params.set('CompanyId', companyId);

    this._loading.set(true);
    this.http
      .get<ApiResult<CampaignsApiData>>(`${environment.apiBase}/Campaigns/for-admin`, { params })
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) {
          const p = res.Data.Campaigns;
          this._campaigns.set(p.Items.map(i => this.mapItem(i)));
          this._totalCount.set(p.TotalCount);
          this._totalPages.set(p.TotalPages);
          this._currentPage.set(p.CurrentPage);
          this._pageSize.set(p.PageSize);
        }
      });
  }

  // ── Campaign detail ───────────────────────────────────────────
  loadById(id: string): void {
    this._detailLoading.set(true);
    this._currentCampaign.set(null);
    this.http
      .get<ApiResult<CampaignApiItem>>(`${environment.apiBase}/Campaigns/${id}`)
      .pipe(finalize(() => this._detailLoading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) {
          this._currentCampaign.set(this.mapItem(res.Data));
        }
      });
  }

  createCampaign(name: string, number: string, color: string): Observable<boolean> {
    const body = {
      Name:      name,
      Number:    number,
      CompanyId: this.auth.currentUser()?.companyId ?? '',
      Color:     color,
    };
    return this.http
      .post<ApiResult<unknown>>(`${environment.apiBase}/Campaigns`, body)
      .pipe(
        take(1),
        tap(res => {
          if (res.IsSuccess) {
            this._allCampaignsCache = null;
            this.loadCampaigns({ PageNumber: this._currentPage(), PageSize: 10 });
          }
        }),
        map(res => !!res.IsSuccess),
      );
  }

  // ── Groups ────────────────────────────────────────────────────
  loadGroups(campaignId: string, pageNumber = 1): void {
    this._groupsLoading.set(true);
    this._groups.set([]);
    const params = new HttpParams()
      .set('CampaignId', campaignId)
      .set('PageNumber', String(pageNumber))
      .set('PageSize',   '10');
    this.http
      .get<ApiResult<PaginatedResult<GroupApiItem>>>(`${environment.apiBase}/Groups`, { params })
      .pipe(finalize(() => this._groupsLoading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) {
          this._groups.set(res.Data.Items);
          this._groupsTotalPages.set(res.Data.TotalPages);
          this._groupsCurrentPage.set(res.Data.CurrentPage);
          this._groupsTotalCount.set(res.Data.TotalCount);
        }
      });
  }

  createGroup(name: string, notes: string, campaignId: string): void {
    const body = { Name: name, Notes: notes, CampaignId: campaignId, CompanyId: this.auth.currentUser()?.companyId ?? '' };
    this.http
      .post<ApiResult<unknown>>(`${environment.apiBase}/Groups`, body)
      .pipe(take(1))
      .subscribe(res => {
        if (res.IsSuccess) {
          this.loadGroups(campaignId);
          this._currentCampaign.update(c => c ? { ...c, groupsCount: c.groupsCount + 1 } : c);
        }
      });
  }

  // ── Buses ─────────────────────────────────────────────────────
  loadBuses(campaignId: string, pageNumber = 1): void {
    this._busesLoading.set(true);
    this._buses.set([]);
    const params = new HttpParams()
      .set('CampaignId', campaignId)
      .set('PageNumber', String(pageNumber))
      .set('PageSize',   '10');
    this.http
      .get<ApiResult<PaginatedResult<BusApiItem>>>(`${environment.apiBase}/Buses`, { params })
      .pipe(finalize(() => this._busesLoading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) {
          this._buses.set(res.Data.Items);
          this._busesTotalPages.set(res.Data.TotalPages);
          this._busesCurrentPage.set(res.Data.CurrentPage);
          this._busesTotalCount.set(res.Data.TotalCount);
        }
      });
  }

  createBus(campaignId: string, form: BusForm): void {
    const body = {
      BusNumber:   form.number.trim(),
      DriverName:  form.driverName.trim(),
      SeatsCount:  form.capacity ? +form.capacity : 45,
      DriverPhone: form.driverPhone,
      BusType:     form.type,
      PlateNumber: form.plateNumber.trim(),
      Notes:       form.notes.trim(),
      CampaignId:  campaignId,
      CompanyId:   this.auth.currentUser()?.companyId ?? '',
    };
    this.http
      .post<ApiResult<unknown>>(`${environment.apiBase}/Buses`, body)
      .pipe(take(1))
      .subscribe(res => {
        if (res.IsSuccess) {
          this.loadBuses(campaignId);
          this._currentCampaign.update(c => c ? { ...c, busesCount: c.busesCount + 1 } : c);
        }
      });
  }

  // ── Mapping ───────────────────────────────────────────────────
  private mapItem(item: CampaignApiItem): Campaign {
    return {
      id:               item.Id,
      number:           item.Number,
      name:             item.Name,
      status:           'نشطة' as CampaignStatus,
      color:            item.Color ?? '',
      companyId:        item.CompanyId,
      pilgrimsCount:    item.PilgrimsCount,
      groupsCount:      item.GroupsCount,
      supervisorsCount: item.SupervisorsCount,
      busesCount:       item.BusesCount,
      accommodation:    '',
      notes:            '',
      groups:           [],
      buses:            [],
    };
  }
}
