import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { CreatePilgrimRequest, DrugApiItem, PilgrimApiItem, PilgrimDetailApiItem, PilgrimFamilyApiItem, PilgrimRitualsApiItem, PilgrimsQuery, ReviewApiItem, UpdatePilgrimRequest } from './pilgrims.model';

@Injectable({ providedIn: 'root' })
export class PilgrimsService {
  private readonly http = inject(HttpClient);

  private readonly _list = signal<PilgrimApiItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _total = signal(0);
  private readonly _totalPages = signal(0);
  private readonly _page = signal(1);

  readonly list = this._list.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly total = this._total.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly page = this._page.asReadonly();

  createPilgrim(req: CreatePilgrimRequest): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(`${environment.apiBase}/Pilgrims`, req);
  }

  updatePilgrim(req: UpdatePilgrimRequest): Observable<ApiResult<unknown>> {
    return this.http.put<ApiResult<unknown>>(`${environment.apiBase}/Pilgrims`, req);
  }

  getPilgrimById(id: string): Observable<ApiResult<PilgrimDetailApiItem>> {
    return this.http.get<ApiResult<PilgrimDetailApiItem>>(`${environment.apiBase}/Pilgrims/${id}`);
  }

  getPilgrimFamily(id: string): Observable<ApiResult<PilgrimFamilyApiItem[]>> {
    return this.http.get<ApiResult<PilgrimFamilyApiItem[]>>(`${environment.apiBase}/Pilgrims/${id}/family`);
  }

  getReviewsByUserId(userId: string, language = 'ar'): Observable<ApiResult<ReviewApiItem[]>> {
    const headers = new HttpHeaders({
      'Accept-Language': language,
    });

    return this.http.get<ApiResult<ReviewApiItem[]>>(`${environment.apiBase}/Reviews/${userId}`, { headers });
  }

  getDrugsByUserId(userId: string, language = 'ar'): Observable<ApiResult<DrugApiItem[]>> {
    const headers = new HttpHeaders({ 'Accept-Language': language });
    return this.http.get<ApiResult<DrugApiItem[]>>(`${environment.apiBase}/Drugs/user/${userId}`, { headers });
  }

  getRitualsByUserId(userId: string, language = 'ar'): Observable<ApiResult<PilgrimRitualsApiItem>> {
    const headers = new HttpHeaders({
      'Accept-Language': language,
    });

    const params = new HttpParams().set('userId', userId);

    return this.http.get<ApiResult<PilgrimRitualsApiItem>>(`${environment.apiBase}/Rituals/pilgrim`, {
      headers,
      params,
    });
  }

  downloadTemplate(campaignId: string, groupId: string, language = 'ar'): Observable<HttpResponse<Blob>> {
    const params = new HttpParams()
      .set('campaignId', campaignId)
      .set('groupId', groupId);

    const headers = new HttpHeaders({
      'Accept-Language': language,
    });

    return this.http.get(`${environment.apiBase}/Pilgrims/template`, {
      params,
      headers,
      responseType: 'blob',
      observe: 'response',
    });
  }

  uploadPilgrimsFile(file: File, language = 'ar'): Observable<ApiResult<unknown> | { issuccess?: boolean; IsSuccess?: boolean }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers = new HttpHeaders({
      'Accept-Language': language,
    });

    return this.http.post<ApiResult<unknown> | { issuccess?: boolean; IsSuccess?: boolean }>(
      `${environment.apiBase}/Pilgrims/upload`,
      formData,
      { headers },
    );
  }

  loadForAdmin(query: PilgrimsQuery = {}): void {
    let params = new HttpParams()
      .set('PageNumber', String(query.PageNumber ?? 1))
      .set('PageSize', String(query.PageSize ?? 20));

    if (query.Search) params = params.set('Search', query.Search);
    if (query.CampaignId) params = params.set('CampaignId', query.CampaignId);
    if (query.SortBy !== undefined) params = params.set('SortBy', String(query.SortBy));

    this._loading.set(true);
    this.http
      .get<ApiResult<PaginatedResult<PilgrimApiItem>>>(
        `${environment.apiBase}/Pilgrims/for-admin`,
        { params },
      )
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe(res => {
        if (res.IsSuccess) {
          this._list.set(res.Data.Items);
          this._total.set(res.Data.TotalCount);
          this._totalPages.set(res.Data.TotalPages);
          this._page.set(res.Data.CurrentPage);
        }
      });
  }
}
