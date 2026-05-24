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

import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { TourLeaderListItem } from './tour-leaders.model';
import { TourLeadersService } from './tour-leaders.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

@Component({
  selector: 'app-tour-leaders',
  imports: [DecimalPipe, ProgressSpinnerModule, TranslateModule],
  templateUrl: './tour-leaders.html',
  styleUrl: './tour-leaders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TourLeaders implements OnInit {
  private readonly service = inject(TourLeadersService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly tourLeaders = signal<TourLeaderListItem[]>([]);
  readonly listLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly currentPage = signal(1);
  readonly pageSize = signal<number>(10);
  readonly searchText = signal('');
  readonly brokenAvatars = signal<Set<string>>(new Set());

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
        this.loadTourLeaders();
      });

    this.loadTourLeaders();
  }

  loadTourLeaders(): void {
    this.listLoading.set(true);
    this.loadError.set(null);

    this.service.getTourLeaders({
      searchText: this.searchText() || undefined,
      pageNumber: this.currentPage(),
      pageSize: this.pageSize(),
    })
      .pipe(finalize(() => this.listLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.handleLoadError(res, 'TOUR_LEADERS.ERRORS.LOAD');
            return;
          }

          const data = res.Data;
          this.tourLeaders.set(data?.Items ?? []);
          this.totalCount.set(data?.TotalCount ?? 0);
          this.totalPages.set(Math.max(data?.TotalPages ?? 1, 1));
        },
        error: err => this.handleLoadError(err?.error, 'TOUR_LEADERS.ERRORS.LOAD'),
      });
  }

  onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadTourLeaders();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadTourLeaders();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadTourLeaders();
    }
  }

  goToPage(page: number): void {
    if (page !== this.currentPage()) {
      this.currentPage.set(page);
      this.loadTourLeaders();
    }
  }

  onAvatarError(id: string): void {
    this.brokenAvatars.update(set => {
      if (set.has(id)) return set;
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  hasValidAvatar(leader: TourLeaderListItem): string | null {
    if (this.brokenAvatars().has(leader.Id)) return null;
    return this.mediaUrl(leader.AvatarUrl);
  }

  initials(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    return trimmed ? trimmed.charAt(0) : '?';
  }

  mediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    return `${environment.uploadsBase}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private handleLoadError(error: ApiResult<unknown> | undefined, fallbackKey: string): void {
    const message = this.resolveApiErrorMessage(error, fallbackKey);
    this.tourLeaders.set([]);
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
