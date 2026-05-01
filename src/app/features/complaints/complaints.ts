import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/services/auth';
import { ApiResult } from '../../core/models/api.models';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ComplaintApiItem } from './complaints.model';
import { ComplaintsService } from './complaints.service';

@Component({
  selector: 'app-complaints',
  imports: [FormsModule, ProgressSpinnerModule, DecimalPipe],
  templateUrl: './complaints.html',
  styleUrl: './complaints.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Complaints {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly campaignsService = inject(CampaignsService);
  private readonly complaintsService = inject(ComplaintsService);

  readonly pageSize = signal(10);
  readonly loading = signal(false);

  readonly complaints = signal<ComplaintApiItem[]>([]);
  readonly selectedCampaignId = signal('');
  readonly selectedCampaignName = signal('');
  readonly selectedGroupId = signal('');
  readonly selectedGroupName = signal('');
  readonly selectedSortBy = signal(0);

  readonly campaignList = signal<CampaignApiItem[]>([]);
  readonly campaignLoading = signal(false);
  readonly groupList = signal<GroupApiItem[]>([]);
  readonly groupLoading = signal(false);

  readonly openCampaignDrop = signal(false);
  readonly openGroupDrop = signal(false);

  readonly totalCount = signal(0);
  readonly totalPages = signal(0);
  readonly currentPage = signal(1);
  readonly hasNext = signal(false);
  readonly hasPrevious = signal(false);

  readonly hasAnyFilterDropdownOpen = computed(() =>
    this.openCampaignDrop() || this.openGroupDrop(),
  );

  readonly affectedCampaignsCount = computed(() =>
    new Set(this.complaints().map((c) => c.CampaignName)).size,
  );

  readonly affectedGroupsCount = computed(() =>
    new Set(this.complaints().map((c) => c.GroupName)).size,
  );

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
    this.loadComplaints();
  }

  toggleCampaignDrop(event: Event): void {
    event.stopPropagation();
    if (this.openCampaignDrop()) {
      this.openCampaignDrop.set(false);
      return;
    }
    this.openGroupDrop.set(false);
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
    this.openGroupDrop.set(true);
    if (this.groupList().length === 0) this.fetchGroups(this.selectedCampaignId());
  }

  selectCampaignFilter(campaign?: CampaignApiItem): void {
    this.selectedCampaignId.set(campaign?.Id ?? '');
    this.selectedCampaignName.set(campaign?.Name ?? '');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.groupList.set([]);
    this.openCampaignDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  selectGroupFilter(group?: GroupApiItem): void {
    this.selectedGroupId.set(group?.Id ?? '');
    this.selectedGroupName.set(group?.Name ?? '');
    this.openGroupDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  closeAllDropdowns(): void {
    this.openCampaignDrop.set(false);
    this.openGroupDrop.set(false);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadComplaints();
  }

  nextPage(): void {
    if (!this.hasNext()) return;
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    if (!this.hasPrevious()) return;
    this.goToPage(this.currentPage() - 1);
  }

  campaignFilterLabel(): string {
    return this.selectedCampaignName() || 'جميع المراكز';
  }

  groupFilterLabel(): string {
    return this.selectedGroupName() || (this.selectedCampaignId() ? 'جميع المجموعات' : 'اختر المركز أولًا');
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

  private loadComplaints(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) {
      this.reset();
      return;
    }

    this.loading.set(true);
    this.complaintsService.getComplaints({
      CompanyId: companyId,
      CampaignId: this.selectedCampaignId() || undefined,
      GroupId: this.selectedGroupId() || undefined,
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
          if (!res.IsSuccess) { this.reset(); return; }

          this.complaints.set(res.Data?.Items ?? []);
          this.totalCount.set(res.Data?.TotalCount ?? 0);
          this.totalPages.set(res.Data?.TotalPages ?? 0);
          this.currentPage.set(res.Data?.CurrentPage ?? 1);
          this.hasNext.set(res.Data?.HasNext ?? false);
          this.hasPrevious.set(res.Data?.HasPrevious ?? false);
        },
        error: () => this.reset(),
      });
  }

  private reset(): void {
    this.complaints.set([]);
    this.totalCount.set(0);
    this.totalPages.set(0);
    this.hasNext.set(false);
    this.hasPrevious.set(false);
  }
}
