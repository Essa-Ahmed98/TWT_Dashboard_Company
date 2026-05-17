import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/services/auth';
import { ApiResult } from '../../core/models/api.models';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { CampaignsService } from '../campaigns/campaigns.service';
import { environment } from '../../../environments/environment';
import { NotificationAudienceRole, NotificationType, SendNotificationRequest, SentNotificationItem } from './notifications.model';
import { NotificationsService } from './notifications.service';
import { TranslationService as AppTranslationService } from '../../core/services/translation.service';
import { SsDropdownDirective } from '../../shared/directives/ss-dropdown.directive';

type NotificationsTab = 'send' | 'templates' | 'sent';

interface AudienceOption {
  role: NotificationAudienceRole;
  labelKey: string;
  summaryKey: string;
}

interface TypeOption {
  type: NotificationType;
  labelKey: string;
  icon: string;
  tone: 'general' | 'health' | 'location' | 'emergency' | 'dispatch' | 'religious' | 'schedule' | 'message';
}

interface NotificationTemplate {
  titleKey: string;
  bodyKey: string;
  type: NotificationType;
  audienceKey: string;
}

@Component({
  selector: 'app-notifications',
  imports: [TranslateModule, SsDropdownDirective],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications {
  private readonly service = inject(NotificationsService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly campaignsService = inject(CampaignsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly appTranslation = inject(AppTranslationService);

  readonly NotificationAudienceRole = NotificationAudienceRole;

  readonly audienceOptions: AudienceOption[] = [
    { role: NotificationAudienceRole.All, labelKey: 'NOTIFICATIONS.AUDIENCE.ALL_LABEL', summaryKey: 'NOTIFICATIONS.AUDIENCE.ALL_SUMMARY' },
    { role: NotificationAudienceRole.Pilgrims, labelKey: 'NOTIFICATIONS.AUDIENCE.PILGRIMS_LABEL', summaryKey: 'NOTIFICATIONS.AUDIENCE.PILGRIMS_SUMMARY' },
    { role: NotificationAudienceRole.Supervisors, labelKey: 'NOTIFICATIONS.AUDIENCE.SUPERVISORS_LABEL', summaryKey: 'NOTIFICATIONS.AUDIENCE.SUPERVISORS_SUMMARY' },
    { role: NotificationAudienceRole.Families, labelKey: 'NOTIFICATIONS.AUDIENCE.FAMILIES_LABEL', summaryKey: 'NOTIFICATIONS.AUDIENCE.FAMILIES_SUMMARY' },
  ];

  readonly typeOptions: TypeOption[] = [
    { type: NotificationType.General, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.GENERAL', icon: 'pi-info-circle', tone: 'general' },
    { type: NotificationType.Health, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.HEALTH', icon: 'pi-heart', tone: 'health' },
    { type: NotificationType.Location, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.LOCATION', icon: 'pi-map-marker', tone: 'location' },
    { type: NotificationType.Emergency, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.EMERGENCY', icon: 'pi-shield', tone: 'emergency' },
    { type: NotificationType.Dispatch, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.DISPATCH', icon: 'pi-truck', tone: 'dispatch' },
    { type: NotificationType.Religious, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.RELIGIOUS', icon: 'pi-sparkles', tone: 'religious' },
    { type: NotificationType.Schedule, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.SCHEDULE', icon: 'pi-calendar-clock', tone: 'schedule' },
    { type: NotificationType.Message, labelKey: 'NOTIFICATIONS.TYPE_OPTIONS.MESSAGE', icon: 'pi-comment', tone: 'message' },
  ];

  readonly templates: NotificationTemplate[] = [
    {
      titleKey: 'NOTIFICATIONS.TEMPLATES.WATER_TITLE',
      bodyKey: 'NOTIFICATIONS.TEMPLATES.WATER_BODY',
      type: NotificationType.Health,
      audienceKey: 'NOTIFICATIONS.AUDIENCE.PILGRIMS_SUMMARY',
    },
    {
      titleKey: 'NOTIFICATIONS.TEMPLATES.DISPATCH_TITLE',
      bodyKey: 'NOTIFICATIONS.TEMPLATES.DISPATCH_BODY',
      type: NotificationType.Dispatch,
      audienceKey: 'NOTIFICATIONS.AUDIENCE.PILGRIMS_SUMMARY',
    },
    {
      titleKey: 'NOTIFICATIONS.TEMPLATES.SUPERVISOR_MEETING_TITLE',
      bodyKey: 'NOTIFICATIONS.TEMPLATES.SUPERVISOR_MEETING_BODY',
      type: NotificationType.Schedule,
      audienceKey: 'NOTIFICATIONS.AUDIENCE.SUPERVISORS_SUMMARY',
    },
    {
      titleKey: 'NOTIFICATIONS.TEMPLATES.RITUAL_TITLE',
      bodyKey: 'NOTIFICATIONS.TEMPLATES.RITUAL_BODY',
      type: NotificationType.Religious,
      audienceKey: 'NOTIFICATIONS.AUDIENCE.PILGRIMS_SUMMARY',
    },
    {
      titleKey: 'NOTIFICATIONS.TEMPLATES.GEOFENCE_TITLE',
      bodyKey: 'NOTIFICATIONS.TEMPLATES.GEOFENCE_BODY',
      type: NotificationType.Location,
      audienceKey: 'NOTIFICATIONS.AUDIENCE.SUPERVISORS_SUMMARY',
    },
    {
      titleKey: 'NOTIFICATIONS.TEMPLATES.FAMILY_TITLE',
      bodyKey: 'NOTIFICATIONS.TEMPLATES.FAMILY_BODY',
      type: NotificationType.General,
      audienceKey: 'NOTIFICATIONS.AUDIENCE.FAMILIES_SUMMARY',
    },
  ];

  selectedAudienceRole = signal<NotificationAudienceRole>(NotificationAudienceRole.All);
  showAudienceDrop = signal(false);

  campList = signal<CampaignApiItem[]>([]);
  campLoading = signal(false);
  showCampDrop = signal(false);
  selectedCampId = signal('');
  selectedCampName = signal('');

  grpList = signal<GroupApiItem[]>([]);
  grpLoading = signal(false);
  showGrpDrop = signal(false);
  selectedGroupId = signal('');
  selectedGrpName = signal('');

  selectedType = signal<NotificationType>(NotificationType.General);
  title = signal('');
  body = signal('');
  submitting = signal(false);
  submitError = signal<string | null>(null);
  activeTab = signal<NotificationsTab>('send');

  sentItems = signal<SentNotificationItem[]>([]);
  sentLoading = signal(false);
  sentError = signal<string | null>(null);
  sentPage = signal(1);
  sentPageSize = 10;
  sentTotalPages = signal(0);
  sentTotalCount = signal(0);

  readonly sentHasPrevious = computed(() => this.sentPage() > 1);
  readonly sentHasNext = computed(() => this.sentPage() < this.sentTotalPages());
  readonly sentPageNumbers = computed<(number | '...')[]>(() => {
    const total = this.sentTotalPages();
    const current = this.sentPage();
    const delta = 1;
    const pages: (number | '...')[] = [];

    for (let page = 1; page <= total; page++) {
      if (page === 1 || page === total || Math.abs(page - current) <= delta) {
        pages.push(page);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return pages;
  });

  readonly selectedAudienceLabel = computed(() =>
    this.audienceOptions.find(option => option.role === this.selectedAudienceRole())?.labelKey ?? ''
  );

  readonly audienceSummary = computed(() => {
    this.appTranslation.currentLang();
    const roleKey = this.audienceOptions.find(option => option.role === this.selectedAudienceRole())?.summaryKey ?? '';
    const role = roleKey ? this.translate.instant(roleKey) : '';
    const campaign = this.selectedCampName() || this.translate.instant('NOTIFICATIONS.ALL_CAMPAIGNS');
    const group = this.selectedGrpName() || this.translate.instant('NOTIFICATIONS.ALL_GROUPS');
    return `${role} - ${campaign} - ${group}`;
  });

  readonly titleCount = computed(() => this.title().trim().length);
  readonly bodyCount = computed(() => this.body().trim().length);
  readonly selectedTypeOption = computed(() => this.notificationTypeOption(this.selectedType()));

  readonly canSend = computed(() =>
    this.title().trim().length > 0 &&
    this.title().trim().length <= 100 &&
    this.body().trim().length <= 500 &&
    this.body().trim().length > 0 &&
    !this.submitting()
  );

  setTab(tab: NotificationsTab): void {
    this.activeTab.set(tab);
    this.closeAllDrops();

    if (tab === 'sent') {
      this.loadSent(1);
    }
  }

  selectAudience(role: NotificationAudienceRole): void {
    this.selectedAudienceRole.set(role);
    this.showAudienceDrop.set(false);
  }

  toggleAudienceDrop(): void {
    this.closeDropsExcept('audience');
    this.showAudienceDrop.update(open => !open);
  }

  private fetchCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.campLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(finalize(() => this.campLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.campList.set(data));
  }

  toggleCampDrop(): void {
    this.closeDropsExcept('campaign');
    this.showCampDrop.update(open => !open);
    if (this.showCampDrop() && this.campList().length === 0 && !this.campLoading()) {
      this.fetchCampaigns();
    }
  }

  selectCamp(campaign: CampaignApiItem): void {
    this.selectedCampId.set(campaign.Id);
    this.selectedCampName.set(campaign.Name);
    this.selectedGroupId.set('');
    this.selectedGrpName.set('');
    this.grpList.set([]);
    this.showCampDrop.set(false);
  }

  clearCamp(): void {
    this.selectedCampId.set('');
    this.selectedCampName.set('');
    this.clearGrp();
    this.grpList.set([]);
  }

  private fetchGroups(campaignId: string): void {
    this.grpLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(finalize(() => this.grpLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        if (res.IsSuccess) this.grpList.set(res.Data);
      });
  }

  toggleGrpDrop(): void {
    if (!this.selectedCampId()) return;

    this.closeDropsExcept('group');
    this.showGrpDrop.update(open => !open);
    if (this.showGrpDrop() && this.grpList().length === 0) this.fetchGroups(this.selectedCampId());
  }

  selectGrp(group: GroupApiItem): void {
    this.selectedGroupId.set(group.Id);
    this.selectedGrpName.set(group.Name);
    this.showGrpDrop.set(false);
  }

  clearGrp(): void {
    this.selectedGroupId.set('');
    this.selectedGrpName.set('');
  }

  closeAllDrops(): void {
    this.showAudienceDrop.set(false);
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
  }

  setType(type: NotificationType): void {
    this.selectedType.set(type);
  }

  useTemplate(template: NotificationTemplate): void {
    this.selectedType.set(template.type);
    this.title.set(this.translate.instant(template.titleKey));
    this.body.set(this.translate.instant(template.bodyKey));
    this.activeTab.set('send');
    this.closeAllDrops();
  }

  send(): void {
    if (!this.canSend()) return;

    const companyId = this.auth.currentUser()?.companyId ?? '';
    const payload: SendNotificationRequest = {
      Title: this.title().trim(),
      Body: this.body().trim(),
      Type: this.selectedType(),
      IsUrgent: true,
      Audience: {
        Role: this.selectedAudienceRole(),
        CompanyId: companyId,
        CampaignId: this.selectedCampId() || null,
        GroupId: this.selectedGroupId() || null,
      },
      Metadata: '',
    };

    this.submitting.set(true);
    this.submitError.set(null);
    this.service.send(payload)
      .pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) {
            this.resetForm();
            this.toast.add({
              severity: 'success',
              summary: this.translate.instant('NOTIFICATIONS.SENT_SUCCESS_SUMMARY'),
              detail: this.translate.instant('NOTIFICATIONS.SENT_SUCCESS_DETAIL'),
            });
            if (this.activeTab() === 'sent') this.loadSent(1);
          } else {
            this.submitError.set(this.resolveApiErrorMessage(res));
          }
        },
        error: err => this.submitError.set(this.resolveApiErrorMessage(err?.error as ApiResult<unknown> | undefined)),
      });
  }

  private resetForm(): void {
    this.selectedAudienceRole.set(NotificationAudienceRole.All);
    this.selectedCampId.set('');
    this.selectedCampName.set('');
    this.selectedGroupId.set('');
    this.selectedGrpName.set('');
    this.grpList.set([]);
    this.selectedType.set(NotificationType.General);
    this.title.set('');
    this.body.set('');
    this.closeAllDrops();
  }

  loadSent(page = this.sentPage()): void {
    this.sentLoading.set(true);
    this.sentError.set(null);
    this.service.getSent({ PageNumber: page, PageSize: this.sentPageSize })
      .pipe(finalize(() => this.sentLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.sentError.set(this.resolveApiErrorMessage(res));
            return;
          }

          this.sentItems.set(res.Data.Items);
          const totalCount = res.Data.TotalCount ?? res.Data.Items.length;
          const pageSize = res.Data.PageSize || this.sentPageSize;
          const totalPages = res.Data.TotalPages || Math.ceil(totalCount / pageSize);

          this.sentPage.set(res.Data.CurrentPage || page);
          this.sentTotalPages.set(totalPages);
          this.sentTotalCount.set(totalCount);
        },
        error: err => this.sentError.set(this.resolveApiErrorMessage(err?.error as ApiResult<unknown> | undefined)),
      });
  }

  goToSentPage(page: number | '...'): void {
    if (page === '...' || page < 1 || page > this.sentTotalPages() || page === this.sentPage() || this.sentLoading()) return;
    this.loadSent(page);
  }

  nextSentPage(): void {
    this.goToSentPage(this.sentPage() + 1);
  }

  prevSentPage(): void {
    this.goToSentPage(this.sentPage() - 1);
  }

  notificationTypeOption(type: NotificationType): TypeOption {
    return this.typeOptions.find(option => option.type === type) ?? this.typeOptions[0];
  }

  sentCardClass(item: SentNotificationItem): string {
    return `sent-card__icon sent-card__icon--${this.notificationTypeOption(item.Type).tone}`;
  }

  templateIconClass(template: NotificationTemplate): string {
    return `sent-card__icon sent-card__icon--${this.notificationTypeOption(template.type).tone}`;
  }

  formatCreatedAt(value: string): string {
    const created = new Date(value);
    if (Number.isNaN(created.getTime())) return '';

    const diffMs = Date.now() - created.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return this.translate.instant('COMMON.NOW');
    if (diffMinutes < 60) return this.translate.instant('COMMON.MINUTE_AGO', { value: diffMinutes });

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return this.translate.instant('COMMON.HOUR_AGO', { value: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return this.translate.instant('COMMON.DAY_AGO', { value: diffDays });

    return created.toLocaleDateString(this.translate.currentLang || 'en', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private resolveApiErrorMessage(error?: ApiResult<unknown> | null): string {
    return error?.Error?.MessageKey ||
      error?.Error?.message ||
      error?.ValidationErrors?.[0]?.ErrorMessage ||
      this.translate.instant('NOTIFICATIONS.SEND_ERROR');
  }

  private closeDropsExcept(drop: 'audience' | 'campaign' | 'group'): void {
    if (drop !== 'audience') this.showAudienceDrop.set(false);
    if (drop !== 'campaign') this.showCampDrop.set(false);
    if (drop !== 'group') this.showGrpDrop.set(false);
  }
}
