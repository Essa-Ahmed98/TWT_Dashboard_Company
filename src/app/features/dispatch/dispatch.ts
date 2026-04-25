import { HttpClient, HttpParams } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/services/auth';
import { ApiResult, PaginatedResult } from '../../core/models/api.models';
import { BusApiItem, CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { CampaignsService } from '../campaigns/campaigns.service';
import {
  CreateTransportationScheduleRequest,
  TransportationScheduleApiItem,
} from './dispatch.model';
import { DispatchService } from './dispatch.service';

type TripStatus = 'pending' | 'active' | 'arrived';

interface DispatchItem {
  id: string;
  code: string;
  campaign: string;
  group: string;
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  pilgrimsCount: number;
  busLabel: string;
  driverName: string;
  status: TripStatus;
  note?: string;
}

interface DispatchForm {
  campaignId: string;
  campaignName: string;
  groupId: string;
  groupName: string;
  busId: string;
  busName: string;
  fromLocation: string;
  toLocation: string;
  departureTime: Date | string;
  notes: string;
}

const EMPTY_FORM: DispatchForm = {
  campaignId: '',
  campaignName: '',
  groupId: '',
  groupName: '',
  busId: '',
  busName: '',
  fromLocation: '',
  toLocation: '',
  departureTime: '',
  notes: '',
};

@Component({
  selector: 'app-dispatch',
  imports: [FormsModule, ProgressSpinnerModule, DatePicker, DecimalPipe],
  templateUrl: './dispatch.html',
  styleUrl: './dispatch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dispatch {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly campaignsService = inject(CampaignsService);
  private readonly dispatchService = inject(DispatchService);
  private readonly search$ = new Subject<string>();
  readonly pageSize = signal(10);

  readonly title = 'إدارة التفويج والنقل';
  readonly subtitle = 'جدولة الحافلات ومتابعة حركة التفويج بين المشاعر';

  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly selectedCampaignId = signal('');
  readonly selectedCampaignName = signal('');
  readonly selectedGroupId = signal('');
  readonly selectedGroupName = signal('');
  readonly selectedBusId = signal('');
  readonly selectedBusName = signal('');
  readonly openCampaignDrop = signal(false);
  readonly openGroupDrop = signal(false);
  readonly openBusDrop = signal(false);

  readonly campaignList = signal<CampaignApiItem[]>([]);
  readonly campaignLoading = signal(false);
  readonly groupList = signal<GroupApiItem[]>([]);
  readonly groupLoading = signal(false);
  readonly busList = signal<BusApiItem[]>([]);
  readonly busLoading = signal(false);

  readonly items = signal<DispatchItem[]>([]);
  readonly totalCount = signal(0);
  readonly totalPages = signal(0);
  readonly currentPage = signal(1);
  readonly hasNext = signal(false);
  readonly hasPrevious = signal(false);

  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly submitError = signal('');
  readonly form = signal<DispatchForm>({ ...EMPTY_FORM });
  readonly openModalCampaignDrop = signal(false);
  readonly openModalGroupDrop = signal(false);
  readonly openModalBusDrop = signal(false);
  readonly modalCampaignLoading = signal(false);
  readonly modalGroupLoading = signal(false);
  readonly modalBusLoading = signal(false);
  readonly modalCampaignList = signal<CampaignApiItem[]>([]);
  readonly modalGroupList = signal<GroupApiItem[]>([]);
  readonly modalBusList = signal<BusApiItem[]>([]);

  readonly hasAnyFilterDropdownOpen = computed(() =>
    this.openCampaignDrop() || this.openGroupDrop() || this.openBusDrop()
  );

  readonly isCreateFormValid = computed(() => {
    const form = this.form();
    return Boolean(
      form.campaignId &&
      form.groupId &&
      form.busId &&
      form.fromLocation.trim() &&
      form.toLocation.trim() &&
      form.departureTime
    );
  });

  readonly stats = computed(() => {
    const items = this.items();
    return [
      {
        label: 'قادمة',
        value: items.filter((item) => item.status === 'pending').length,
        icon: 'pi-clock',
        tone: 'pending',
      },
      {
        label: 'انطلقت',
        value: items.filter((item) => item.status === 'active').length,
        icon: 'pi-check-circle',
        tone: 'active',
      },
      {
        label: 'وصلت الرحلات',
        value: items.filter((item) => item.status === 'arrived').length,
        icon: 'pi-car',
        tone: 'arrived',
      },
    ];
  });

  readonly visiblePages = computed<(number | '...')[]>(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3)         pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  readonly lastItem = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalCount())
  );

  constructor() {
    this.loadSchedules();

    this.search$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadSchedules();
      });
  }

  statusLabel(status: TripStatus): string {
    return {
      pending: 'قادمة',
      active: 'انطلقت',
      arrived: 'وصلت',
    }[status];
  }

  statusClass(status: TripStatus): string {
    return status;
  }

  campaignFilterLabel(): string {
    return this.selectedCampaignName() || 'اختر مركز';
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  openCreateModal(): void {
    this.form.set({ ...EMPTY_FORM });
    this.submitError.set('');
    this.closeModalDropdowns();
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.closeModalDropdowns();
    this.showModal.set(false);
  }

  toggleCampaignDrop(event: Event): void {
    event.stopPropagation();
    if (this.openCampaignDrop()) {
      this.closeCampaignDrop();
      return;
    }

    this.openGroupDrop.set(false);
    this.openBusDrop.set(false);
    this.openCampaignDrop.set(true);
    if (this.campaignList().length === 0) this.fetchFilterCampaigns();
  }

  closeCampaignDrop(): void {
    this.openCampaignDrop.set(false);
  }

  selectCampaignFilter(campaign?: CampaignApiItem): void {
    this.selectedCampaignId.set(campaign?.Id ?? '');
    this.selectedCampaignName.set(campaign?.Name ?? '');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.selectedBusId.set('');
    this.selectedBusName.set('');
    this.groupList.set([]);
    this.busList.set([]);
    this.closeCampaignDrop();
    this.currentPage.set(1);
    this.loadSchedules();
  }

  toggleGroupDrop(event: Event): void {
    event.stopPropagation();
    if (!this.selectedCampaignId()) return;

    if (this.openGroupDrop()) {
      this.closeGroupDrop();
      return;
    }

    this.openCampaignDrop.set(false);
    this.openBusDrop.set(false);
    this.openGroupDrop.set(true);
    if (this.groupList().length === 0) this.fetchFilterGroups(this.selectedCampaignId());
  }

  closeGroupDrop(): void {
    this.openGroupDrop.set(false);
  }

  selectGroupFilter(group?: GroupApiItem): void {
    this.selectedGroupId.set(group?.Id ?? '');
    this.selectedGroupName.set(group?.Name ?? '');
    this.closeGroupDrop();
    this.currentPage.set(1);
    this.loadSchedules();
  }

  toggleBusDrop(event: Event): void {
    event.stopPropagation();
    if (!this.selectedCampaignId()) return;

    if (this.openBusDrop()) {
      this.closeBusDrop();
      return;
    }

    this.openCampaignDrop.set(false);
    this.openGroupDrop.set(false);
    this.openBusDrop.set(true);
    if (this.busList().length === 0) this.fetchFilterBuses(this.selectedCampaignId());
  }

  closeBusDrop(): void {
    this.openBusDrop.set(false);
  }

  selectBusFilter(bus?: BusApiItem): void {
    this.selectedBusId.set(bus?.Id ?? '');
    this.selectedBusName.set(bus?.BusNumber ?? '');
    this.closeBusDrop();
    this.currentPage.set(1);
    this.loadSchedules();
  }

  closeAllDropdowns(): void {
    this.closeCampaignDrop();
    this.closeGroupDrop();
    this.closeBusDrop();
  }

  toggleModalCampaignDrop(event: Event): void {
    event.stopPropagation();
    if (this.openModalCampaignDrop()) {
      this.openModalCampaignDrop.set(false);
      return;
    }

    this.openModalGroupDrop.set(false);
    this.openModalBusDrop.set(false);
    this.openModalCampaignDrop.set(true);
    if (this.modalCampaignList().length === 0) this.fetchModalCampaigns();
  }

  toggleModalGroupDrop(event: Event): void {
    event.stopPropagation();
    if (!this.form().campaignId) return;

    if (this.openModalGroupDrop()) {
      this.openModalGroupDrop.set(false);
      return;
    }

    this.openModalCampaignDrop.set(false);
    this.openModalBusDrop.set(false);
    this.openModalGroupDrop.set(true);
    if (this.modalGroupList().length === 0) this.fetchModalGroups(this.form().campaignId);
  }

  toggleModalBusDrop(event: Event): void {
    event.stopPropagation();
    if (!this.form().campaignId) return;

    if (this.openModalBusDrop()) {
      this.openModalBusDrop.set(false);
      return;
    }

    this.openModalCampaignDrop.set(false);
    this.openModalGroupDrop.set(false);
    this.openModalBusDrop.set(true);
    if (this.modalBusList().length === 0) this.fetchModalBuses(this.form().campaignId);
  }

  selectModalCampaign(campaign: CampaignApiItem): void {
    this.form.update((form) => ({
      ...form,
      campaignId: campaign.Id,
      campaignName: campaign.Name,
      groupId: '',
      groupName: '',
      busId: '',
      busName: '',
    }));
    this.modalGroupList.set([]);
    this.modalBusList.set([]);
    this.openModalCampaignDrop.set(false);
  }

  clearModalCampaign(event: Event): void {
    event.stopPropagation();
    this.form.update((form) => ({
      ...form,
      campaignId: '',
      campaignName: '',
      groupId: '',
      groupName: '',
      busId: '',
      busName: '',
    }));
    this.modalGroupList.set([]);
    this.modalBusList.set([]);
  }

  selectModalGroup(group: GroupApiItem): void {
    this.form.update((form) => ({
      ...form,
      groupId: group.Id,
      groupName: group.Name,
    }));
    this.openModalGroupDrop.set(false);
  }

  clearModalGroup(event: Event): void {
    event.stopPropagation();
    this.form.update((form) => ({
      ...form,
      groupId: '',
      groupName: '',
    }));
  }

  selectModalBus(bus: BusApiItem): void {
    this.form.update((form) => ({
      ...form,
      busId: bus.Id,
      busName: bus.BusNumber,
    }));
    this.openModalBusDrop.set(false);
  }

  clearModalBus(event: Event): void {
    event.stopPropagation();
    this.form.update((form) => ({
      ...form,
      busId: '',
      busName: '',
    }));
  }

  patchForm(patch: Partial<DispatchForm>): void {
    this.form.update((form) => ({ ...form, ...patch }));
    if (this.submitError()) this.submitError.set('');
  }

  submitForm(): void {
    if (this.saving()) return;
    if (!this.isCreateFormValid()) {
      this.submitError.set('يرجى استكمال البيانات المطلوبة.');
      return;
    }

    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) {
      this.submitError.set('تعذر تحديد الشركة الحالية.');
      return;
    }

    const body = this.buildCreatePayload(companyId);
    if (!body) {
      this.submitError.set('يرجى اختيار موعد انطلاق صحيح.');
      return;
    }

    this.saving.set(true);
    this.submitError.set('');
    this.dispatchService.createSchedule(body)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res?.IsSuccess === false) {
            this.submitError.set(res.Error?.MessageKey || 'حدث خطأ أثناء إضافة الرحلة.');
            return;
          }

          this.saving.set(false);
          this.closeModal();
          this.currentPage.set(1);
          this.loadSchedules();
        },
        error: () => this.submitError.set('حدث خطأ أثناء إضافة الرحلة.'),
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadSchedules();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadSchedules();
  }

  nextPage(): void {
    if (!this.hasNext()) return;
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    if (!this.hasPrevious()) return;
    this.goToPage(this.currentPage() - 1);
  }

  private closeModalDropdowns(): void {
    this.openModalCampaignDrop.set(false);
    this.openModalGroupDrop.set(false);
    this.openModalBusDrop.set(false);
  }

  private fetchFilterCampaigns(): void {
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

  private fetchFilterGroups(campaignId: string): void {
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

  private fetchFilterBuses(campaignId: string): void {
    this.busLoading.set(true);
    const params = new HttpParams()
      .set('CampaignId', campaignId)
      .set('PageNumber', '1')
      .set('PageSize', '100');

    this.http
      .get<ApiResult<PaginatedResult<BusApiItem>>>(`${environment.apiBase}/Buses`, { params })
      .pipe(
        finalize(() => this.busLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.busList.set(res.Data.Items);
      });
  }

  private fetchModalCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.modalCampaignLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(
        finalize(() => this.modalCampaignLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.modalCampaignList.set(data));
  }

  private fetchModalGroups(campaignId: string): void {
    this.modalGroupLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(
        finalize(() => this.modalGroupLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.modalGroupList.set(res.Data);
      });
  }

  private fetchModalBuses(campaignId: string): void {
    this.modalBusLoading.set(true);
    const params = new HttpParams()
      .set('CampaignId', campaignId)
      .set('PageNumber', '1')
      .set('PageSize', '100');

    this.http
      .get<ApiResult<PaginatedResult<BusApiItem>>>(`${environment.apiBase}/Buses`, { params })
      .pipe(
        finalize(() => this.modalBusLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.modalBusList.set(res.Data.Items);
      });
  }

  private buildCreatePayload(companyId: string): CreateTransportationScheduleRequest | null {
    const form = this.form();
    const departureDate = new Date(form.departureTime);
    if (Number.isNaN(departureDate.getTime())) return null;

    return {
      CompanyId: companyId,
      CampaignId: form.campaignId,
      GroupId: form.groupId,
      BusId: form.busId,
      FromLocation: form.fromLocation.trim(),
      ToLocation: form.toLocation.trim(),
      DepartureTime: departureDate.toISOString(),
      Notes: form.notes.trim(),
    };
  }

  private loadSchedules(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) {
      this.items.set([]);
      this.totalCount.set(0);
      this.totalPages.set(0);
      this.hasNext.set(false);
      this.hasPrevious.set(false);
      return;
    }

    this.loading.set(true);
    this.dispatchService.getSchedules({
      CompanyId: companyId,
      CampaignId: this.selectedCampaignId() || undefined,
      GroupId: this.selectedGroupId() || undefined,
      BusId: this.selectedBusId() || undefined,
      Search: this.searchQuery() || undefined,
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
            this.items.set([]);
            this.totalCount.set(0);
            this.totalPages.set(0);
            this.hasNext.set(false);
            this.hasPrevious.set(false);
            return;
          }

          this.items.set(res.Data.Items.map((item) => this.mapSchedule(item)));
          this.totalCount.set(res.Data.TotalCount);
          this.totalPages.set(res.Data.TotalPages);
          this.currentPage.set(res.Data.CurrentPage);
          this.hasNext.set(res.Data.HasNext);
          this.hasPrevious.set(res.Data.HasPrevious);
        },
        error: () => {
          this.items.set([]);
          this.totalCount.set(0);
          this.totalPages.set(0);
          this.hasNext.set(false);
          this.hasPrevious.set(false);
        },
      });
  }

  private mapSchedule(item: TransportationScheduleApiItem): DispatchItem {
    const campaignName = this.campaignList().find((campaign) => campaign.Id === item.CampaignId)?.Name
      ?? this.modalCampaignList().find((campaign) => campaign.Id === item.CampaignId)?.Name
      ?? this.selectedCampaignName()
      ?? item.CampaignId
      ?? '—';

    const groupName = this.groupList().find((group) => group.Id === item.GroupId)?.Name
      ?? this.modalGroupList().find((group) => group.Id === item.GroupId)?.Name
      ?? this.selectedGroupName()
      ?? item.GroupId
      ?? '—';

    const bus = this.busList().find((entry) => entry.Id === item.BusId)
      ?? this.modalBusList().find((entry) => entry.Id === item.BusId);

    const busName = bus?.BusNumber ?? this.selectedBusName() ?? item.BusId ?? '—';
    const driverName = bus?.DriverName ?? '—';

    return {
      id: item.Id,
      code: item.Id.slice(0, 8),
      campaign: campaignName,
      group: groupName,
      routeFrom: item.FromLocation || '—',
      routeTo: item.ToLocation || '—',
      departureTime: this.formatDepartureTime(item.DepartureTime),
      pilgrimsCount: 0,
      busLabel: busName === '—' ? '—' : `حافلة ${busName}`,
      driverName,
      status: this.statusFromDate(item.DepartureTime),
      note: item.Notes || '',
    };
  }

  private formatDepartureTime(value: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private statusFromDate(value: string): TripStatus {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'pending';

    const diff = date.getTime() - Date.now();
    if (diff > 60 * 60 * 1000) return 'pending';
    if (diff > 0) return 'active';
    return 'arrived';
  }
}
