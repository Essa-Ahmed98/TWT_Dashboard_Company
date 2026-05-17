import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';

import { AuthService } from '../../core/auth/services/auth';
import {
  CampaignDropdownItem,
  GroupDropdownItem,
} from '../complaints/complaints.model';
import { ComplaintsService } from '../complaints/complaints.service';
import { HealthConditionItem } from './critical-health-cases.model';
import { CriticalHealthCasesService } from './critical-health-cases.service';

type HealthSeverity = 'very-critical' | 'critical' | 'medium';

const HEALTH_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

@Component({
  selector: 'app-critical-health-cases',
  imports: [FormsModule, ProgressSpinnerModule, DecimalPipe, TranslateModule],
  templateUrl: './critical-health-cases.html',
  styleUrl: './critical-health-cases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CriticalHealthCases implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly service = inject(CriticalHealthCasesService);
  private readonly complaintsService = inject(ComplaintsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  private readonly searchSubject = new Subject<string>();

  readonly pageSizeOptions = HEALTH_PAGE_SIZE_OPTIONS;

  readonly healthConditions = signal<HealthConditionItem[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly pageSize = signal(10);
  readonly currentPage = signal(1);
  readonly totalPages = signal(0);
  readonly hasPrevious = signal(false);
  readonly hasNext = signal(false);

  readonly searchInput = signal('');
  readonly searchQuery = signal('');

  readonly campList = signal<CampaignDropdownItem[]>([]);
  readonly campLoading = signal(false);
  readonly campLoaded = signal(false);
  readonly campId = signal('');
  readonly campName = signal('');
  readonly showCampDrop = signal(false);

  readonly grpList = signal<GroupDropdownItem[]>([]);
  readonly grpLoading = signal(false);
  readonly grpLoaded = signal(false);
  readonly groupId = signal('');
  readonly groupName = signal('');
  readonly showGrpDrop = signal(false);

  readonly hasAnyDropdownOpen = computed(() =>
    this.showCampDrop() || this.showGrpDrop(),
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

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.currentPage.set(1);
      this.load(1);
    });

    this.load(1);
  }

  load(page = this.currentPage()): void {
    const companyId = this.currentCompanyId();
    if (!companyId) {
      this.applyEmpty();
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.service.getHealthConditions({
      Search: this.searchQuery() || undefined,
      CompanyId: companyId,
      CampaignId: this.campId() || undefined,
      GroupId: this.groupId() || undefined,
      PageNumber: page,
      PageSize: this.pageSize(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.IsSuccess) {
            this.applyEmpty();
            this.loadError.set(this.translate.instant('CRITICAL_HEALTH.LOAD_ERROR'));
            return;
          }
          const d = res.Data;
          this.healthConditions.set(d?.Items ?? []);
          this.totalCount.set(d?.TotalCount ?? 0);
          this.pageSize.set(d?.PageSize || this.pageSize());
          this.currentPage.set(d?.CurrentPage || page);
          this.totalPages.set(d?.TotalPages ?? 0);
          this.hasPrevious.set(!!d?.HasPrevious);
          this.hasNext.set(!!d?.HasNext);
        },
        error: () => {
          this.applyEmpty();
          this.loadError.set(this.translate.instant('CRITICAL_HEALTH.LOAD_ERROR'));
        },
      });
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.searchSubject.next(value);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load(1);
  }

  toggleCampDrop(event: Event): void {
    event.stopPropagation();
    const companyId = this.currentCompanyId();
    if (!companyId) return;
    if (this.showCampDrop()) { this.showCampDrop.set(false); return; }
    this.closeDrops();
    this.showCampDrop.set(true);
    if (!this.campLoaded()) this.fetchCampaigns(companyId);
  }

  selectCamp(item?: CampaignDropdownItem): void {
    this.campId.set(item?.Id ?? '');
    this.campName.set(item?.Name ?? '');
    this.groupId.set('');
    this.groupName.set('');
    this.grpList.set([]);
    this.grpLoaded.set(false);
    this.showCampDrop.set(false);
    this.currentPage.set(1);
    this.load(1);
  }

  toggleGrpDrop(event: Event): void {
    event.stopPropagation();
    if (!this.campId()) return;
    if (this.showGrpDrop()) { this.showGrpDrop.set(false); return; }
    this.closeDrops();
    this.showGrpDrop.set(true);
    if (!this.grpLoaded()) this.fetchGroups(this.campId());
  }

  selectGrp(item?: GroupDropdownItem): void {
    this.groupId.set(item?.Id ?? '');
    this.groupName.set(item?.Name ?? '');
    this.showGrpDrop.set(false);
    this.currentPage.set(1);
    this.load(1);
  }

  closeDrops(): void {
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
  }

  goToPage(page: number | '...'): void {
    if (page === '...' || page < 1 || page > this.totalPages() || page === this.currentPage() || this.loading()) return;
    this.load(page);
  }

  prevPage(): void { this.goToPage(this.currentPage() - 1); }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }

  openPilgrimProfile(item: HealthConditionItem): void {
    if (!item.PilgrimId) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('COMMON.WARNING'),
        detail: this.translate.instant('CRITICAL_HEALTH.NO_PILGRIM'),
      });
      return;
    }
    void this.router.navigate(['/pilgrims', item.PilgrimId]);
  }

  ageLabel(dateOfBirth: string | null | undefined): string {
    if (!dateOfBirth) return this.translate.instant('CRITICAL_HEALTH.AGE_UNAVAILABLE');
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) return this.translate.instant('CRITICAL_HEALTH.AGE_UNAVAILABLE');

    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    if (age < 0) return this.translate.instant('CRITICAL_HEALTH.AGE_UNAVAILABLE');
    return this.translate.instant('CRITICAL_HEALTH.AGE_VALUE', { value: age });
  }

  severity(item: HealthConditionItem): HealthSeverity {
    if (
      item.HeartRate >= 130 ||
      item.OxygenSaturation < 90 ||
      item.Temperature >= 39 ||
      item.SystolicPressure >= 180 ||
      item.DiastolicPressure >= 120
    ) return 'very-critical';

    if (
      item.HeartRate >= 110 ||
      item.OxygenSaturation < 94 ||
      item.Temperature >= 38 ||
      item.SystolicPressure >= 160 ||
      item.DiastolicPressure >= 100
    ) return 'critical';

    return 'medium';
  }

  severityLabelKey(item: HealthConditionItem): string {
    const s = this.severity(item);
    if (s === 'very-critical') return 'CRITICAL_HEALTH.SEVERITY_VERY_CRITICAL';
    if (s === 'critical') return 'CRITICAL_HEALTH.SEVERITY_CRITICAL';
    return 'CRITICAL_HEALTH.SEVERITY_MEDIUM';
  }

  severityClass(item: HealthConditionItem): string {
    return `health-severity health-severity--${this.severity(item)}`;
  }

  locationLabel(item: HealthConditionItem): string {
    if (item.ZoneName?.trim()) return item.ZoneName;
    if (this.hasCoordinates(item)) return `${item.Latitude.toFixed(5)}, ${item.Longitude.toFixed(5)}`;
    return this.translate.instant('CRITICAL_HEALTH.NOT_AVAILABLE');
  }

  hasCoordinates(item: HealthConditionItem): boolean {
    return Number.isFinite(item.Latitude) && Number.isFinite(item.Longitude) && (item.Latitude !== 0 || item.Longitude !== 0);
  }

  measuredAtLabel(value: string | null | undefined): string {
    if (!value) return this.translate.instant('CRITICAL_HEALTH.NOT_AVAILABLE');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return this.translate.instant('CRITICAL_HEALTH.NOT_AVAILABLE');

    const diff = Math.abs(Date.now() - date.getTime());
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return this.translate.instant('CRITICAL_HEALTH.JUST_NOW');
    if (diff < hour) return this.translate.instant('CRITICAL_HEALTH.MINUTES_AGO', { value: Math.floor(diff / minute) });
    if (diff < day) return this.translate.instant('CRITICAL_HEALTH.HOURS_AGO', { value: Math.floor(diff / hour) });
    if (diff < 7 * day) return this.translate.instant('CRITICAL_HEALTH.DAYS_AGO', { value: Math.floor(diff / day) });
    return date.toLocaleString(this.translate.currentLang || 'en');
  }

  initial(name: string | null | undefined): string {
    return name?.trim().charAt(0) || 'H';
  }

  private fetchCampaigns(companyId: string): void {
    this.campLoading.set(true);
    this.complaintsService.getCampaigns(companyId)
      .pipe(
        finalize(() => this.campLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.campList.set(res.IsSuccess ? res.Data ?? [] : []);
          this.campLoaded.set(true);
        },
        error: () => { this.campList.set([]); this.campLoaded.set(true); },
      });
  }

  private fetchGroups(campaignId: string): void {
    this.grpLoading.set(true);
    this.complaintsService.getGroups(campaignId)
      .pipe(
        finalize(() => this.grpLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.grpList.set(res.IsSuccess ? res.Data?.Items ?? [] : []);
          this.grpLoaded.set(true);
        },
        error: () => { this.grpList.set([]); this.grpLoaded.set(true); },
      });
  }

  private applyEmpty(): void {
    this.healthConditions.set([]);
    this.totalCount.set(0);
    this.totalPages.set(0);
    this.hasPrevious.set(false);
    this.hasNext.set(false);
  }

  private currentCompanyId(): string {
    return this.auth.currentUser()?.companyId ?? '';
  }
}
