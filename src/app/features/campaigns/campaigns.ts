import { ChangeDetectionStrategy, Component, computed, inject, signal, afterNextRender, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CampaignForm, CampaignStatus } from './campaigns.model';
import { CampaignsService } from './campaigns.service';

const EMPTY_FORM: CampaignForm = { name: '', number: '' };

@Component({
  selector: 'app-campaigns',
  imports: [DecimalPipe],
  templateUrl: './campaigns.html',
  styleUrl: './campaigns.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Campaigns implements OnDestroy {
  private readonly service       = inject(CampaignsService);
  private readonly router        = inject(Router);
  private readonly searchSubject = new Subject<string>();
  private readonly subs          = new Subscription();

  constructor() {
    afterNextRender(() => {
      this.service.loadCampaigns({ PageNumber: 1, PageSize: 10 });

      this.subs.add(
        this.searchSubject.pipe(debounceTime(400)).subscribe(search => {
          this.service.loadCampaigns({
            Search:     search || undefined,
            PageNumber: 1,
            PageSize:   this.selectedPageSize(),
          });
        })
      );
    });
  }

  readonly campaigns   = this.service.campaigns;
  readonly loading     = this.service.loading;
  readonly totalCount  = this.service.totalCount;
  readonly totalPages  = this.service.totalPages;
  readonly currentPage = this.service.currentPage;
  readonly pageSize    = this.service.pageSize;

  // ── State ────────────────────────────────────────────────────
  searchQuery      = signal('');
  viewMode         = signal<'grid' | 'list'>('grid');
  showModal        = signal(false);
  submitting       = signal(false);
  formData         = signal<CampaignForm>({ ...EMPTY_FORM });
  selectedPageSize = signal(10);

  // ── Stats ────────────────────────────────────────────────────
  totalGroups = computed(() =>
    this.campaigns().reduce((s, c) => s + c.groupsCount, 0)
  );

  // API does server-side filtering; alias for template compatibility
  filteredCampaigns = this.campaigns;

  // ── Pagination helpers ────────────────────────────────────────
  lastItem = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalCount())
  );

  // ── Pagination: visible page numbers with ellipsis ─────────────
  visiblePages = computed<(number | '...')[]>(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    if (current > 3)         pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ── Search ───────────────────────────────────────────────────
  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  // ── Pagination ────────────────────────────────────────────────
  goToPage(page: number | '...'): void {
    if (page === '...' || page === this.currentPage()) return;
    this.service.loadCampaigns({
      Search:     this.searchQuery() || undefined,
      PageNumber: page,
      PageSize:   this.selectedPageSize(),
    });
  }

  onPageSizeChange(size: number): void {
    this.selectedPageSize.set(size);
    this.service.loadCampaigns({
      Search:     this.searchQuery() || undefined,
      PageNumber: 1,
      PageSize:   size,
    });
  }

  // ── Modal ─────────────────────────────────────────────────────
  openModal(): void {
    this.formData.set({ ...EMPTY_FORM });
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  patchForm(patch: Partial<CampaignForm>): void {
    this.formData.update(f => ({ ...f, ...patch }));
  }

  submitForm(): void {
    const f = this.formData();
    if (!f.name.trim() || !f.number.trim() || this.submitting()) return;

    this.submitting.set(true);
    this.subs.add(
      this.service.createCampaign(f.name.trim(), f.number.trim()).subscribe({
        next: () => { this.submitting.set(false); this.closeModal(); },
        error: () => { this.submitting.set(false); },
      })
    );
  }

  // ── Navigation ────────────────────────────────────────────────
  openDetail(id: string): void { this.router.navigate(['/campaigns', id]); }

  // ── UI helpers ─────────────────────────────────────────────────
  statusClass(status: CampaignStatus): string {
    return { 'نشطة': 'active', 'طارئة': 'urgent', 'مكتملة': 'done' }[status] ?? '';
  }
}
