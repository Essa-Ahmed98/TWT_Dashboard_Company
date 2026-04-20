import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/services/auth';
import { ApiResult } from '../../core/models/api.models';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { CampaignsService } from '../campaigns/campaigns.service';
import {
  ReviewApiItem,
  ReviewCategorySummaryApiItem,
  ReviewsSummaryApiData,
} from './reviews.model';
import { ReviewsService } from './reviews.service';

interface ReviewCategoryOption {
  value: number;
  label: string;
  icon: string;
  accent: string;
}

const EMPTY_RATINGS_SUMMARY: ReviewsSummaryApiData = {
  AverageRating: 0,
  TotalReviews: 0,
  PositiveCount: 0,
  NegativeCount: 0,
  Distribution: [],
};

@Component({
  selector: 'app-reviews',
  imports: [FormsModule, ProgressSpinnerModule, DecimalPipe],
  templateUrl: './reviews.html',
  styleUrl: './reviews.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reviews {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly campaignsService = inject(CampaignsService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly search$ = new Subject<string>();

  readonly pageSize = signal(10);
  readonly loading = signal(false);

  readonly categoryOptions: ReviewCategoryOption[] = [
    { value: 0, label: 'المشرف', icon: 'pi pi-user', accent: 'blue' },
    { value: 1, label: 'النقل والتفويج', icon: 'pi pi-car', accent: 'sky' },
    { value: 2, label: 'السكن', icon: 'pi pi-home', accent: 'green' },
    { value: 3, label: 'الوجبات', icon: 'pi pi-globe', accent: 'amber' },
    { value: 4, label: 'الخدمات الطبية', icon: 'pi pi-heart', accent: 'red' },
    { value: 5, label: 'الإرشاد الديني', icon: 'pi pi-book', accent: 'emerald' },
    { value: 6, label: 'التطبيق', icon: 'pi pi-mobile', accent: 'slate' },
    { value: 7, label: 'عام', icon: 'pi pi-star', accent: 'neutral' },
  ];

  readonly reviews = signal<ReviewApiItem[]>([]);
  readonly searchQuery = signal('');
  readonly selectedCampaignId = signal('');
  readonly selectedCampaignName = signal('');
  readonly selectedGroupId = signal('');
  readonly selectedGroupName = signal('');
  readonly selectedCategory = signal(0);
  readonly selectedSortBy = signal(0);

  readonly campaignList = signal<CampaignApiItem[]>([]);
  readonly campaignLoading = signal(false);
  readonly groupList = signal<GroupApiItem[]>([]);
  readonly groupLoading = signal(false);

  readonly openCampaignDrop = signal(false);
  readonly openGroupDrop = signal(false);
  readonly openCategoryDrop = signal(false);

  readonly totalCount = signal(0);
  readonly totalPages = signal(0);
  readonly currentPage = signal(1);
  readonly hasNext = signal(false);
  readonly hasPrevious = signal(false);

  readonly ratingsSummary = signal<ReviewsSummaryApiData>(EMPTY_RATINGS_SUMMARY);
  readonly categoriesSummary = signal<ReviewCategorySummaryApiItem[]>([]);

  readonly hasAnyFilterDropdownOpen = computed(() =>
    this.openCampaignDrop() || this.openGroupDrop() || this.openCategoryDrop(),
  );

  readonly summary = computed(() => {
    const state = this.ratingsSummary();
    return {
      total: state.TotalReviews,
      positive: state.PositiveCount,
      negative: state.NegativeCount,
      average: state.AverageRating,
    };
  });

  readonly distribution = computed(() => {
    const distribution = new Map(
      (this.ratingsSummary()?.Distribution ?? []).map((item) => [item.Stars, item]),
    );
    return [5, 4, 3, 2, 1].map((stars) => {
      const item = distribution.get(stars);
      return {
        stars,
        count: item?.Count ?? 0,
        percentage: item?.Percentage ?? 0,
      };
    });
  });

  readonly categoryCards = computed(() => {
    const summaryMap = new Map(
      (this.categoriesSummary() ?? []).map((entry) => [entry.Category, entry]),
    );

    return this.categoryOptions.map((category) => {
      const item = summaryMap.get(category.value);
      return {
        ...category,
        count: item?.ReviewsCount ?? 0,
        average: item?.Rating ?? 0,
      };
    });
  });

  readonly hasCategoryCardsData = computed(() =>
    this.categoryCards().some((category) => category.count > 0),
  );

  readonly reviewsCountLabel = computed(() => `${this.summary().total} تقييم من الحجاج`);

  readonly visiblePages = computed<(number | '...')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  constructor() {
    this.loadReviews();

    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadReviews();
      });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  toggleCampaignDrop(event: Event): void {
    event.stopPropagation();
    if (this.openCampaignDrop()) {
      this.openCampaignDrop.set(false);
      return;
    }

    this.openGroupDrop.set(false);
    this.openCategoryDrop.set(false);
    this.openCampaignDrop.set(true);
    if (this.campaignList().length === 0) this.fetchCampaigns();
  }

  toggleGroupDrop(event: Event): void {
    event.stopPropagation();
    if (!this.selectedCampaignId()) return;

    if (this.openGroupDrop()) {
      this.openGroupDrop.set(false);
      return;
    }

    this.openCampaignDrop.set(false);
    this.openCategoryDrop.set(false);
    this.openGroupDrop.set(true);
    if (this.groupList().length === 0) this.fetchGroups(this.selectedCampaignId());
  }

  toggleCategoryDrop(event: Event): void {
    event.stopPropagation();
    this.openCampaignDrop.set(false);
    this.openGroupDrop.set(false);
    this.openCategoryDrop.update((value) => !value);
  }

  selectCampaignFilter(campaign?: CampaignApiItem): void {
    this.selectedCampaignId.set(campaign?.Id ?? '');
    this.selectedCampaignName.set(campaign?.Name ?? '');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.groupList.set([]);
    this.openCampaignDrop.set(false);
    this.currentPage.set(1);
    this.loadReviews();
  }

  selectGroupFilter(group?: GroupApiItem): void {
    this.selectedGroupId.set(group?.Id ?? '');
    this.selectedGroupName.set(group?.Name ?? '');
    this.openGroupDrop.set(false);
    this.currentPage.set(1);
    this.loadReviews();
  }

  selectCategoryFilter(value?: number): void {
    if (value === undefined) return;
    this.selectedCategory.set(value);
    this.openCategoryDrop.set(false);
    this.currentPage.set(1);
    this.loadReviews();
  }

  closeAllDropdowns(): void {
    this.openCampaignDrop.set(false);
    this.openGroupDrop.set(false);
    this.openCategoryDrop.set(false);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadReviews();
  }

  nextPage(): void {
    if (!this.hasNext()) return;
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    if (!this.hasPrevious()) return;
    this.goToPage(this.currentPage() - 1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadReviews();
  }

  stars(value: number): number[] {
    return Array.from({ length: Math.max(0, Math.min(5, Math.round(value))) });
  }

  emptyStars(value: number): number[] {
    return Array.from({ length: Math.max(0, 5 - Math.max(0, Math.min(5, Math.round(value)))) });
  }

  campaignFilterLabel(): string {
    return this.selectedCampaignName() || 'جميع الحملات';
  }

  groupFilterLabel(): string {
    if (this.selectedGroupName()) return this.selectedGroupName();
    return this.selectedCampaignId() ? 'اختر الحملة أولًا' : 'اختر الحملة أولًا';
  }

  categoryFilterLabel(): string {
    return this.categoryOptions.find((item) => item.value === this.selectedCategory())?.label ?? 'اختر الفئة';
  }

  categoryLabel(category: number): string {
    return this.categoryOptions.find((item) => item.value === category)?.label ?? `تصنيف ${category}`;
  }

  categoryIcon(category: number): string {
    return this.categoryOptions.find((item) => item.value === category)?.icon ?? 'pi pi-star';
  }

  categoryAccent(category: number): string {
    return this.categoryOptions.find((item) => item.value === category)?.accent ?? 'neutral';
  }

  ratingLabel(rating: number): string {
    if (rating >= 4) return 'ممتاز';
    if (rating === 3) return 'متوسط';
    return 'ضعيف';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  }

  private fetchCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.campaignLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(
        finalize(() => this.campaignLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.campaignList.set(data));
  }

  private fetchGroups(campaignId: string): void {
    this.groupLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(
        finalize(() => this.groupLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.groupList.set(res.Data);
      });
  }

  private loadReviews(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) {
      this.reviews.set([]);
      this.totalCount.set(0);
      this.totalPages.set(0);
      this.hasNext.set(false);
      this.hasPrevious.set(false);
      this.ratingsSummary.set(EMPTY_RATINGS_SUMMARY);
      this.categoriesSummary.set([]);
      return;
    }

    this.loading.set(true);
    this.reviewsService.getReviews({
      CompanyId: companyId,
      Search: this.searchQuery() || undefined,
      GroupId: this.selectedGroupId() || undefined,
      CampaignId: this.selectedCampaignId() || undefined,
      Category: this.selectedCategory(),
      SortBy: this.selectedSortBy(),
      PageNumber: this.currentPage(),
      PageSize: this.pageSize(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.IsSuccess) {
            this.reviews.set([]);
            this.totalCount.set(0);
            this.totalPages.set(0);
            this.hasNext.set(false);
            this.hasPrevious.set(false);
            this.ratingsSummary.set(EMPTY_RATINGS_SUMMARY);
            this.categoriesSummary.set([]);
            return;
          }

          this.reviews.set(res.Data?.Reviews?.Items ?? []);
          this.totalCount.set(res.Data?.Reviews?.TotalCount ?? 0);
          this.totalPages.set(res.Data?.Reviews?.TotalPages ?? 0);
          this.currentPage.set(res.Data?.Reviews?.CurrentPage ?? 1);
          this.hasNext.set(res.Data?.Reviews?.HasNext ?? false);
          this.hasPrevious.set(res.Data?.Reviews?.HasPrevious ?? false);
          this.ratingsSummary.set({
            ...EMPTY_RATINGS_SUMMARY,
            ...(res.Data?.Ratings ?? {}),
            Distribution: res.Data?.Ratings?.Distribution ?? [],
          });
          this.categoriesSummary.set(res.Data?.Categories ?? []);
        },
        error: () => {
          this.reviews.set([]);
          this.totalCount.set(0);
          this.totalPages.set(0);
          this.hasNext.set(false);
          this.hasPrevious.set(false);
          this.ratingsSummary.set(EMPTY_RATINGS_SUMMARY);
          this.categoriesSummary.set([]);
        },
      });
  }
}
