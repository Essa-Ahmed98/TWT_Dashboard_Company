import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SupervisorDetailData } from '../../supervisor-detail.model';
import { SupervisorsService } from '../../../supervisors.service';
import { PilgrimGroupItem } from '../../../supervisors.model';

@Component({
  selector: 'app-sv-pilgrims-tab',
  imports: [ProgressSpinnerModule],
  templateUrl: './pilgrims-tab.html',
  styleUrl: './pilgrims-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPilgrimsTab implements OnInit {
  private readonly service = inject(SupervisorsService);
  private readonly destroyRef = inject(DestroyRef);

  supervisor = input.required<SupervisorDetailData>();

  loading    = signal(false);
  pilgrims   = signal<PilgrimGroupItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  currentPage = signal(1);
  searchQuery = signal('');

  readonly pageSize = 10;

  private readonly load$        = new Subject<{ page: number; search: string }>();
  private readonly searchInput$ = new Subject<string>();

  hasNext     = computed(() => this.currentPage() < this.totalPages());
  hasPrevious = computed(() => this.currentPage() > 1);
  pageNumbers = computed(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    const start   = Math.max(1, current - 2);
    const end     = Math.min(total, current + 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(search => {
        this.searchQuery.set(search);
        this.currentPage.set(1);
        this.load$.next({ page: 1, search });
      });

    this.load$
      .pipe(
        switchMap(({ page, search }) => {
          const groupId = this.supervisor().groupId;
          if (!groupId) {
            return of(null);
          }
          this.loading.set(true);
          return this.service.getPilgrimsByGroup({ groupId, search, pageNumber: page, pageSize: this.pageSize }).pipe(
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => {
        if (res?.IsSuccess && res.Data) {
          this.pilgrims.set(res.Data.Items);
          this.totalCount.set(res.Data.TotalCount);
          this.totalPages.set(res.Data.TotalPages);
          this.currentPage.set(res.Data.CurrentPage);
        } else {
          this.pilgrims.set([]);
          this.totalCount.set(0);
          this.totalPages.set(0);
        }
        this.loading.set(false);
      });

    this.load$.next({ page: 1, search: '' });
  }

  onSearch(value: string): void {
    this.searchInput$.next(value);
  }

  loadPage(page: number): void {
    this.currentPage.set(page);
    this.load$.next({ page, search: this.searchQuery() });
  }

  nextPage(): void { if (this.hasNext())     this.loadPage(this.currentPage() + 1); }
  prevPage(): void { if (this.hasPrevious()) this.loadPage(this.currentPage() - 1); }
  goToPage(p: number): void { this.loadPage(p); }

  getInitials(name: string): string {
    if (!name) return '؟';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]).join('') || name[0];
  }

  genderLabel(gender: number): string {
    return gender === 0 ? 'ذكر' : gender === 1 ? 'أنثى' : '—';
  }

  getAge(value: string): string {
    if (!value) return '—';
    const birth = new Date(value);
    if (isNaN(birth.getTime())) return '—';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} سنة`;
  }
}
