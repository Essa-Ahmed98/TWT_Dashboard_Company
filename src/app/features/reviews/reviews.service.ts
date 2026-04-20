import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { ReviewsApiData, ReviewsQuery } from './reviews.model';

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);

  getReviews(query: ReviewsQuery): Observable<ApiResult<ReviewsApiData>> {
    let params = new HttpParams()
      .set('CompanyId', query.CompanyId)
      .set('PageNumber', String(query.PageNumber))
      .set('PageSize', String(query.PageSize))
      .set('SortBy', String(query.SortBy ?? 0));

    if (query.Search?.trim()) params = params.set('Search', query.Search.trim());
    if (query.GroupId) params = params.set('GroupId', query.GroupId);
    if (query.CampaignId) params = params.set('CampaignId', query.CampaignId);
    if (query.Category !== undefined) params = params.set('Category', String(query.Category));
    if (query.Rating !== undefined) params = params.set('Rating', String(query.Rating));

    return this.http.get<ApiResult<ReviewsApiData>>(`${environment.apiBase}/Reviews`, { params });
  }
}
