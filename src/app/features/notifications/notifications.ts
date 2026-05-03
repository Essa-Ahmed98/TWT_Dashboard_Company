import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
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

type NotificationsTab = 'send' | 'templates' | 'sent';

interface AudienceOption {
  role: NotificationAudienceRole;
  label: string;
  summary: string;
}

interface TypeOption {
  type: NotificationType;
  label: string;
  icon: string;
  tone: 'general' | 'health' | 'location' | 'emergency' | 'dispatch' | 'religious' | 'schedule' | 'message';
}

interface NotificationTemplate {
  title: string;
  body: string;
  type: NotificationType;
  audience: string;
}

@Component({
  selector: 'app-notifications',
  imports: [],
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

  readonly NotificationAudienceRole = NotificationAudienceRole;

  readonly audienceOptions: AudienceOption[] = [
    { role: NotificationAudienceRole.All, label: 'الجميع (حجاج + مشرفين + عائلات)', summary: 'كل المستخدمين' },
    { role: NotificationAudienceRole.Pilgrims, label: 'الحجاج فقط', summary: 'الحجاج' },
    { role: NotificationAudienceRole.Supervisors, label: 'المشرفين فقط', summary: 'المشرفين' },
    { role: NotificationAudienceRole.Families, label: 'العائلات فقط', summary: 'العائلات' },
  ];

  readonly typeOptions: TypeOption[] = [
    { type: NotificationType.General, label: 'عام', icon: 'pi-info-circle', tone: 'general' },
    { type: NotificationType.Health, label: 'صحي', icon: 'pi-heart', tone: 'health' },
    { type: NotificationType.Location, label: 'مكاني / جغرافي', icon: 'pi-map-marker', tone: 'location' },
    { type: NotificationType.Emergency, label: 'طوارئ', icon: 'pi-shield', tone: 'emergency' },
    { type: NotificationType.Dispatch, label: 'تفويج / نقل', icon: 'pi-truck', tone: 'dispatch' },
    { type: NotificationType.Religious, label: 'ديني / مناسك', icon: 'pi-sparkles', tone: 'religious' },
    { type: NotificationType.Schedule, label: 'جدول / موعد', icon: 'pi-calendar-clock', tone: 'schedule' },
    { type: NotificationType.Message, label: 'رسالة', icon: 'pi-comment', tone: 'message' },
  ];

  readonly templates: NotificationTemplate[] = [
    {
      title: 'تنبيه شرب الماء',
      body: 'يرجى الحرص على شرب الماء بكثرة والبقاء في المناطق المظللة لتجنب الإجهاد الحراري',
      type: NotificationType.Health,
      audience: 'الحجاج',
    },
    {
      title: 'موعد تفويج',
      body: 'يرجى التجمع في نقطة التجمع المحددة قبل الموعد بـ 15 دقيقة استعدادا للتفويج',
      type: NotificationType.Dispatch,
      audience: 'الحجاج',
    },
    {
      title: 'اجتماع مشرفين',
      body: 'يرجى حضور جميع المشرفين للاجتماع في الموعد المحدد لمراجعة خطة اليوم',
      type: NotificationType.Schedule,
      audience: 'المشرفين',
    },
    {
      title: 'تذكير بمناسك اليوم',
      body: 'اليوم هو يوم التروية، التوجه إلى منى والالتزام بالذكر والدعاء',
      type: NotificationType.Religious,
      audience: 'الحجاج',
    },
    {
      title: 'تنبيه السياج الجغرافي',
      body: 'بعض الحجاج خرجوا من المنطقة الآمنة. يرجى المتابعة الفورية',
      type: NotificationType.Location,
      audience: 'المشرفين',
    },
    {
      title: 'تحديث للعائلات',
      body: 'حجاجكم بخير والحمد لله. سيتم تحديث الموقع كل ساعة',
      type: NotificationType.General,
      audience: 'العائلات',
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
    this.audienceOptions.find(option => option.role === this.selectedAudienceRole())?.label ?? ''
  );

  readonly audienceSummary = computed(() => {
    const role = this.audienceOptions.find(option => option.role === this.selectedAudienceRole())?.summary ?? '';
    const campaign = this.selectedCampName() || 'كل الحملات';
    const group = this.selectedGrpName() || 'كل المجموعات';
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
    this.title.set(template.title);
    this.body.set(template.body);
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
              summary: 'تم الإرسال',
              detail: 'تم إرسال الإشعار بنجاح',
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
    if (diffMinutes < 1) return 'الآن';
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `منذ ${diffDays} يوم`;

    return created.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private resolveApiErrorMessage(error?: ApiResult<unknown> | null): string {
    return error?.Error?.MessageKey ||
      error?.Error?.message ||
      error?.ValidationErrors?.[0]?.ErrorMessage ||
      'حدث خطأ أثناء إرسال الإشعار';
  }

  private closeDropsExcept(drop: 'audience' | 'campaign' | 'group'): void {
    if (drop !== 'audience') this.showAudienceDrop.set(false);
    if (drop !== 'campaign') this.showCampDrop.set(false);
    if (drop !== 'group') this.showGrpDrop.set(false);
  }
}
