import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ApiResult } from '../../core/models/api.models';
import { TourGroupListItem } from './tour-groups.model';
import { TourGroupsService } from './tour-groups.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

@Component({
  selector: 'app-tour-groups',
  imports: [DecimalPipe, ProgressSpinnerModule, TranslateModule],
  templateUrl: './tour-groups.html',
  styleUrl: './tour-groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TourGroups implements OnInit {
  private readonly service = inject(TourGroupsService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly tourGroups = signal<TourGroupListItem[]>([]);
  readonly listLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly currentPage = signal(1);
  readonly pageSize = signal<number>(10);
  readonly sortBy = signal<string>('tourDateTime');
  readonly isDescending = signal<boolean>(false);
  readonly searchText = signal('');

  private readonly search$ = new Subject<string>();

  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(text => {
        this.searchText.set(text);
        this.currentPage.set(1);
        this.loadTourGroups();
      });

    this.loadTourGroups();
  }

  loadTourGroups(): void {
    this.listLoading.set(true);
    this.loadError.set(null);

    this.service.getTourGroups({
      pageNumber: this.currentPage(),
      pageSize: this.pageSize(),
      sortBy: this.sortBy(),
      isDescending: this.isDescending(),
      searchTerm: this.searchText() || undefined,
    })
      .pipe(finalize(() => this.listLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.handleLoadError(res, 'TOUR_GROUPS.ERRORS.LOAD');
            return;
          }

          const data = res.Data;
          this.tourGroups.set(data?.Items ?? []);
          this.totalCount.set(data?.TotalCount ?? 0);
          this.totalPages.set(Math.max(data?.TotalPages ?? 1, 1));
        },
        error: err => this.handleLoadError(err?.error, 'TOUR_GROUPS.ERRORS.LOAD'),
      });
  }

  onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadTourGroups();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadTourGroups();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadTourGroups();
    }
  }

  goToPage(page: number): void {
    if (page !== this.currentPage()) {
      this.currentPage.set(page);
      this.loadTourGroups();
    }
  }

  formatDateTime(iso: string | null | undefined): string {
    const date = this.toDate(iso);
    if (!date) return '-';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toDate(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) {
      const fallback = new Date(iso);
      return isNaN(fallback.getTime()) ? null : fallback;
    }
    const [, yyyy, mm, dd, hh, mi, ss] = match;
    const date = new Date(+yyyy, +mm - 1, +dd, +hh, +mi, ss ? +ss : 0);
    return isNaN(date.getTime()) ? null : date;
  }

  private handleLoadError(error: ApiResult<unknown> | undefined, fallbackKey: string): void {
    const message = this.resolveApiErrorMessage(error, fallbackKey);
    this.tourGroups.set([]);
    this.totalCount.set(0);
    this.totalPages.set(1);
    this.loadError.set(message);
    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('COMMON.ERROR'),
      detail: message,
    });
  }

  private resolveApiErrorMessage(error: ApiResult<unknown> | undefined, fallbackKey: string): string {
    return error?.Error?.MessageKey
      || error?.Error?.Message
      || error?.Error?.message
      || error?.ValidationErrors?.[0]?.ErrorMessage
      || this.translate.instant(fallbackKey);
  }
}
