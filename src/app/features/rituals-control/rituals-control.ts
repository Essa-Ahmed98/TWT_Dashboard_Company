import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/auth/services/auth';
import {
  RitualApiItem,
  RitualProgressStatus,
  RitualsControlCampaignItem,
  RitualsControlGroupItem,
  UpdateGroupRitualProgressPayload,
} from './rituals-control.model';
import { RitualsControlService } from './rituals-control.service';

@Component({
  selector: 'app-rituals-control',
  imports: [TranslateModule],
  templateUrl: './rituals-control.html',
  styleUrl: './rituals-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RitualsControl {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(RitualsControlService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly RitualProgressStatus = RitualProgressStatus;

  readonly campaignList = signal<RitualsControlCampaignItem[]>([]);
  readonly campaignLoading = signal(false);
  readonly selectedCampaignId = signal('');
  readonly selectedCampaignName = signal('');
  readonly openCampaignDrop = signal(false);

  readonly groupList = signal<RitualsControlGroupItem[]>([]);
  readonly groupLoading = signal(false);
  readonly selectedGroupId = signal('');
  readonly selectedGroupName = signal('');
  readonly openGroupDrop = signal(false);

  readonly rituals = signal<RitualApiItem[]>([]);
  readonly ritualsLoaded = signal(false);
  readonly ritualsLoading = signal(false);
  readonly selectedRitualId = signal('');
  readonly selectedRitual = signal<RitualApiItem | null>(null);
  readonly openRitualDrop = signal(false);

  readonly selectedStatus = signal<RitualProgressStatus | null>(null);
  readonly openStatusDrop = signal(false);

  readonly saving = signal(false);

  readonly hasAnyDropdownOpen = computed(() =>
    this.openCampaignDrop() ||
    this.openGroupDrop() ||
    this.openRitualDrop() ||
    this.openStatusDrop(),
  );

  readonly statusOptions: { value: RitualProgressStatus; labelKey: string }[] = [
    { value: RitualProgressStatus.NotStarted, labelKey: 'RITUALS_CONTROL.STATUS_NOT_STARTED' },
    { value: RitualProgressStatus.InProgress, labelKey: 'RITUALS_CONTROL.STATUS_IN_PROGRESS' },
    { value: RitualProgressStatus.Completed,  labelKey: 'RITUALS_CONTROL.STATUS_COMPLETED' },
  ];

  toggleCampaignDrop(event: Event): void {
    event.stopPropagation();
    const companyId = this.currentCompanyId();
    if (!companyId) return;
    if (this.openCampaignDrop()) { this.openCampaignDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openCampaignDrop.set(true);
    if (this.campaignList().length === 0) this.fetchCampaigns(companyId);
  }

  selectCampaign(campaign?: RitualsControlCampaignItem): void {
    this.selectedCampaignId.set(campaign?.Id ?? '');
    this.selectedCampaignName.set(campaign?.Name ?? '');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.groupList.set([]);
    this.openCampaignDrop.set(false);
  }

  toggleGroupDrop(event: Event): void {
    event.stopPropagation();
    if (!this.selectedCampaignId()) return;
    if (this.openGroupDrop()) { this.openGroupDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openGroupDrop.set(true);
    if (this.groupList().length === 0) this.fetchGroups(this.selectedCampaignId());
  }

  selectGroup(group?: RitualsControlGroupItem): void {
    this.selectedGroupId.set(group?.Id ?? '');
    this.selectedGroupName.set(group?.Name ?? '');
    this.openGroupDrop.set(false);
  }

  toggleRitualDrop(event: Event): void {
    event.stopPropagation();
    if (this.openRitualDrop()) { this.openRitualDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openRitualDrop.set(true);
    if (!this.ritualsLoaded()) this.fetchRituals();
  }

  selectRitual(ritual?: RitualApiItem): void {
    this.selectedRitualId.set(ritual?.Id ?? '');
    this.selectedRitual.set(ritual ?? null);
    this.selectedStatus.set(null);
    this.openRitualDrop.set(false);
  }

  toggleStatusDrop(event: Event): void {
    event.stopPropagation();
    if (this.openStatusDrop()) { this.openStatusDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openStatusDrop.set(true);
  }

  selectStatus(value: RitualProgressStatus): void {
    this.selectedStatus.set(value);
    this.openStatusDrop.set(false);
  }

  statusLabelKey(value: RitualProgressStatus | null): string {
    if (value === null) return 'RITUALS_CONTROL.STATUS_PLACEHOLDER';
    return this.statusOptions.find(o => o.value === value)?.labelKey ?? 'RITUALS_CONTROL.STATUS_PLACEHOLDER';
  }

  statusBadgeClass(value: RitualProgressStatus | null): string {
    switch (value) {
      case RitualProgressStatus.NotStarted: return 'badge badge--notstarted';
      case RitualProgressStatus.InProgress: return 'badge badge--inprogress';
      case RitualProgressStatus.Completed:  return 'badge badge--completed';
      default: return 'badge';
    }
  }

  save(): void {
    const groupId = this.selectedGroupId();
    const ritualId = this.selectedRitualId();
    const status = this.selectedStatus();

    if (!this.selectedCampaignId()) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('COMMON.WARNING'),
        detail: this.translate.instant('RITUALS_CONTROL.VALIDATION_CAMPAIGN'),
      });
      return;
    }
    if (!groupId) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('COMMON.WARNING'),
        detail: this.translate.instant('RITUALS_CONTROL.VALIDATION_GROUP'),
      });
      return;
    }
    if (!ritualId) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('COMMON.WARNING'),
        detail: this.translate.instant('RITUALS_CONTROL.VALIDATION_RITUAL'),
      });
      return;
    }
    if (status === null) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('COMMON.WARNING'),
        detail: this.translate.instant('RITUALS_CONTROL.VALIDATION_STATUS'),
      });
      return;
    }
    if (this.saving()) return;

    const payload: UpdateGroupRitualProgressPayload = {
      GroupId: groupId,
      RitualId: ritualId,
      Status: status,
    };

    this.saving.set(true);
    this.service.updateGroupRitualProgress(payload)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.IsSuccess) {
            this.toast.add({
              severity: 'error',
              summary: this.translate.instant('COMMON.ERROR'),
              detail: this.translate.instant('RITUALS_CONTROL.SAVE_ERROR'),
            });
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant('RITUALS_CONTROL.SAVE_SUCCESS'),
          });
        },
        error: () => {
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('COMMON.ERROR'),
            detail: this.translate.instant('RITUALS_CONTROL.SAVE_ERROR'),
          });
        },
      });
  }

  closeAllDropdowns(): void {
    this.openCampaignDrop.set(false);
    this.openGroupDrop.set(false);
    this.openRitualDrop.set(false);
    this.openStatusDrop.set(false);
  }

  formatHijriDate(hijriDay: number, hijriMonth: string): string {
    if (!hijriDay && !hijriMonth) return '';
    if (!hijriMonth) return String(hijriDay);
    if (!hijriDay) return hijriMonth;
    return `${hijriDay} ${hijriMonth}`;
  }

  private fetchCampaigns(companyId: string): void {
    this.campaignLoading.set(true);
    this.service.getCampaigns(companyId)
      .pipe(
        finalize(() => this.campaignLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.campaignList.set(res.Data ?? []);
      });
  }

  private fetchGroups(campaignId: string): void {
    this.groupLoading.set(true);
    this.service.getGroups(campaignId)
      .pipe(
        finalize(() => this.groupLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.groupList.set(res.Data ?? []);
      });
  }

  private fetchRituals(): void {
    this.ritualsLoading.set(true);
    this.service.getAllRituals()
      .pipe(
        finalize(() => this.ritualsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) {
          const sorted = [...(res.Data ?? [])].sort((a, b) => a.Order - b.Order);
          this.rituals.set(sorted);
          this.ritualsLoaded.set(true);
        }
      });
  }

  private currentCompanyId(): string {
    return this.auth.currentUser()?.companyId ?? '';
  }
}
