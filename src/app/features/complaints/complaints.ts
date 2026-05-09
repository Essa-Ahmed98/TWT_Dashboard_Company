import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../../core/auth/services/auth';
import {
  CampaignDropdownItem,
  ComplaintApiItem,
  ComplaintStatus,
  GroupDropdownItem,
  SupervisorDropdownItem,
} from './complaints.model';
import { ComplaintsService } from './complaints.service';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

@Component({
  selector: 'app-complaints',
  imports: [FormsModule, ProgressSpinnerModule, DecimalPipe],
  templateUrl: './complaints.html',
  styleUrl: './complaints.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Complaints implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly complaintsService = inject(ComplaintsService);
  private readonly toast = inject(MessageService);

  readonly ComplaintStatus = ComplaintStatus;
  readonly pageSize = signal(10);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly loading = signal(false);

  readonly complaints = signal<ComplaintApiItem[]>([]);

  readonly openCount = signal(0);
  readonly solvedCount = signal(0);
  readonly closedCount = signal(0);
  readonly totalCount = computed(() => this.openCount() + this.solvedCount() + this.closedCount());

  readonly campaignList = signal<CampaignDropdownItem[]>([]);
  readonly campaignLoading = signal(false);
  readonly selectedCampaignId = signal('');
  readonly selectedCampaignName = signal('');
  readonly openCampaignDrop = signal(false);

  readonly groupList = signal<GroupDropdownItem[]>([]);
  readonly groupLoading = signal(false);
  readonly selectedGroupId = signal('');
  readonly selectedGroupName = signal('');
  readonly openGroupDrop = signal(false);

  readonly selectedStatusFilter = signal<ComplaintStatus | null>(null);
  readonly openStatusDrop = signal(false);

  readonly supervisorList = signal<SupervisorDropdownItem[]>([]);
  readonly supervisorLoading = signal(false);
  readonly selectedSupervisorId = signal('');
  readonly selectedSupervisorName = signal('');
  readonly openSupervisorDrop = signal(false);
  readonly supervisorSearch = signal('');
  private readonly supervisorSearch$ = new Subject<string>();

  readonly listTotalCount = signal(0);
  readonly totalPages = signal(0);
  readonly currentPage = signal(1);
  readonly hasNext = signal(false);
  readonly hasPrevious = signal(false);

  readonly hasAnyFilterDropdownOpen = computed(() =>
    this.openCampaignDrop() ||
    this.openGroupDrop() ||
    this.openStatusDrop() ||
    this.openSupervisorDrop() ||
    this.openActionDrop() !== null,
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

  readonly statusOptions: { value: ComplaintStatus | null; label: string }[] = [
    { value: null, label: 'جميع الحالات' },
    { value: ComplaintStatus.Open, label: 'مفتوحة' },
    { value: ComplaintStatus.Solved, label: 'تم حلها' },
    { value: ComplaintStatus.Closed, label: 'مغلقة بدون حل' },
  ];

  readonly statusChangeOptions: { value: ComplaintStatus; label: string }[] = [
    { value: ComplaintStatus.Open, label: 'مفتوحة' },
    { value: ComplaintStatus.Solved, label: 'تم حلها' },
    { value: ComplaintStatus.Closed, label: 'مغلقة' },
  ];

  readonly updatingRows = signal<Set<string>>(new Set());
  readonly openActionDrop = signal<string | null>(null);

  readonly showAssignModal = signal(false);
  readonly assigningComplaintId = signal('');
  readonly assignSubmitting = signal(false);

  readonly modalCampaignList = signal<CampaignDropdownItem[]>([]);
  readonly modalCampaignLoading = signal(false);
  readonly modalCampaignId = signal('');
  readonly modalCampaignName = signal('');
  readonly modalOpenCampaignDrop = signal(false);

  readonly modalGroupList = signal<GroupDropdownItem[]>([]);
  readonly modalGroupLoading = signal(false);
  readonly modalGroupId = signal('');
  readonly modalGroupName = signal('');
  readonly modalOpenGroupDrop = signal(false);

  readonly modalSupervisorList = signal<SupervisorDropdownItem[]>([]);
  readonly modalSupervisorLoading = signal(false);
  readonly modalSupervisorId = signal('');
  readonly modalSupervisorName = signal('');
  readonly modalOpenSupervisorDrop = signal(false);
  readonly modalSupervisorSearch = signal('');
  private readonly modalSupervisorSearch$ = new Subject<string>();

  readonly hasAnyModalDropdownOpen = computed(() =>
    this.modalOpenCampaignDrop() ||
    this.modalOpenGroupDrop() ||
    this.modalOpenSupervisorDrop(),
  );

  ngOnInit(): void {
    this.loadComplaints();

    this.supervisorSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.fetchSupervisors(search));

    this.modalSupervisorSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.fetchModalSupervisors(search));
  }

  toggleCampaignDrop(event: Event): void {
    event.stopPropagation();
    const companyId = this.currentCompanyId();
    if (!companyId) return;
    if (this.openCampaignDrop()) { this.openCampaignDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openCampaignDrop.set(true);
    if (this.campaignList().length === 0) this.fetchCampaigns(companyId);
  }

  selectCampaignFilter(campaign?: CampaignDropdownItem): void {
    this.selectedCampaignId.set(campaign?.Id ?? '');
    this.selectedCampaignName.set(campaign?.Name ?? '');
    this.selectedGroupId.set('');
    this.selectedGroupName.set('');
    this.selectedSupervisorId.set('');
    this.selectedSupervisorName.set('');
    this.supervisorSearch.set('');
    this.supervisorList.set([]);
    this.groupList.set([]);
    this.openCampaignDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  toggleGroupDrop(event: Event): void {
    event.stopPropagation();
    if (!this.selectedCampaignId()) return;
    if (this.openGroupDrop()) { this.openGroupDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openGroupDrop.set(true);
    if (this.groupList().length === 0) this.fetchGroups(this.selectedCampaignId());
  }

  selectGroupFilter(group?: GroupDropdownItem): void {
    this.selectedGroupId.set(group?.Id ?? '');
    this.selectedGroupName.set(group?.Name ?? '');
    this.selectedSupervisorId.set('');
    this.selectedSupervisorName.set('');
    this.supervisorSearch.set('');
    this.supervisorList.set([]);
    this.openGroupDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  toggleStatusDrop(event: Event): void {
    event.stopPropagation();
    if (this.openStatusDrop()) { this.openStatusDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openStatusDrop.set(true);
  }

  selectStatusFilter(value: ComplaintStatus | null): void {
    this.selectedStatusFilter.set(value);
    this.openStatusDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  statusFilterLabel(): string {
    const s = this.selectedStatusFilter();
    return s === null ? 'جميع الحالات' : this.statusLabel(s);
  }

  toggleSupervisorDrop(event: Event): void {
    event.stopPropagation();
    if (!this.selectedGroupId()) return;
    if (this.openSupervisorDrop()) { this.openSupervisorDrop.set(false); return; }
    this.closeAllDropdowns();
    this.openSupervisorDrop.set(true);
    if (this.supervisorList().length === 0 && !this.supervisorLoading()) {
      this.fetchSupervisors(this.supervisorSearch());
    }
  }

  onSupervisorSearch(value: string): void {
    this.supervisorSearch.set(value);
    this.supervisorSearch$.next(value);
  }

  selectSupervisorFilter(supervisor: SupervisorDropdownItem): void {
    this.selectedSupervisorId.set(supervisor.Id);
    this.selectedSupervisorName.set(supervisor.Name);
    this.openSupervisorDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  clearSupervisorFilter(): void {
    this.selectedSupervisorId.set('');
    this.selectedSupervisorName.set('');
    this.supervisorSearch.set('');
    this.supervisorList.set([]);
    this.openSupervisorDrop.set(false);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  toggleActionDrop(id: string, event: Event): void {
    event.stopPropagation();
    if (this.openActionDrop() === id) { this.openActionDrop.set(null); return; }
    this.closeAllDropdowns();
    this.openActionDrop.set(id);
  }

  changeStatus(complaint: ComplaintApiItem, newStatus: ComplaintStatus): void {
    this.openActionDrop.set(null);
    if (newStatus === complaint.Status || this.updatingRows().has(complaint.Id)) return;

    const id = complaint.Id;
    const prevStatus = complaint.Status;

    this.complaints.update((list) =>
      list.map((c) => c.Id === id ? { ...c, Status: newStatus } : c),
    );
    this.updatingRows.update((s) => new Set(s).add(id));

    this.complaintsService.updateStatus(id, newStatus)
      .pipe(
        finalize(() => this.updatingRows.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.IsSuccess) {
            this.complaints.update((list) =>
              list.map((c) => c.Id === id ? { ...c, Status: prevStatus } : c),
            );
            this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذر تحديث الحالة' });
            return;
          }
          this.toast.add({ severity: 'success', summary: 'تم', detail: 'تم تحديث الحالة بنجاح' });
          this.loadComplaints(true);
        },
        error: () => {
          this.complaints.update((list) =>
            list.map((c) => c.Id === id ? { ...c, Status: prevStatus } : c),
          );
          this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذر تحديث الحالة' });
        },
      });
  }

  closeAllDropdowns(): void {
    this.openCampaignDrop.set(false);
    this.openGroupDrop.set(false);
    this.openStatusDrop.set(false);
    this.openSupervisorDrop.set(false);
    this.openActionDrop.set(null);
  }

  openAssignModal(complaint: ComplaintApiItem): void {
    this.assigningComplaintId.set(complaint.Id);
    this.openActionDrop.set(null);
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.assigningComplaintId.set('');
    this.assignSubmitting.set(false);
    this.modalCampaignId.set('');
    this.modalCampaignName.set('');
    this.modalGroupId.set('');
    this.modalGroupName.set('');
    this.modalSupervisorId.set('');
    this.modalSupervisorName.set('');
    this.modalSupervisorSearch.set('');
    this.modalCampaignList.set([]);
    this.modalGroupList.set([]);
    this.modalSupervisorList.set([]);
    this.closeModalDropdowns();
  }

  closeModalDropdowns(): void {
    this.modalOpenCampaignDrop.set(false);
    this.modalOpenGroupDrop.set(false);
    this.modalOpenSupervisorDrop.set(false);
  }

  toggleModalCampaignDrop(event: Event): void {
    event.stopPropagation();
    const companyId = this.currentCompanyId();
    if (!companyId) return;
    if (this.modalOpenCampaignDrop()) { this.modalOpenCampaignDrop.set(false); return; }
    this.closeModalDropdowns();
    this.modalOpenCampaignDrop.set(true);
    this.fetchModalCampaigns(companyId);
  }

  selectModalCampaign(campaign?: CampaignDropdownItem): void {
    this.modalCampaignId.set(campaign?.Id ?? '');
    this.modalCampaignName.set(campaign?.Name ?? '');
    this.modalGroupId.set('');
    this.modalGroupName.set('');
    this.modalSupervisorId.set('');
    this.modalSupervisorName.set('');
    this.modalSupervisorSearch.set('');
    this.modalGroupList.set([]);
    this.modalSupervisorList.set([]);
    this.modalOpenCampaignDrop.set(false);
  }

  toggleModalGroupDrop(event: Event): void {
    event.stopPropagation();
    if (!this.modalCampaignId()) return;
    if (this.modalOpenGroupDrop()) { this.modalOpenGroupDrop.set(false); return; }
    this.closeModalDropdowns();
    this.modalOpenGroupDrop.set(true);
    this.fetchModalGroups(this.modalCampaignId());
  }

  selectModalGroup(group?: GroupDropdownItem): void {
    this.modalGroupId.set(group?.Id ?? '');
    this.modalGroupName.set(group?.Name ?? '');
    this.modalSupervisorId.set('');
    this.modalSupervisorName.set('');
    this.modalSupervisorSearch.set('');
    this.modalSupervisorList.set([]);
    this.modalOpenGroupDrop.set(false);
  }

  toggleModalSupervisorDrop(event: Event): void {
    event.stopPropagation();
    if (!this.modalGroupId()) return;
    if (this.modalOpenSupervisorDrop()) { this.modalOpenSupervisorDrop.set(false); return; }
    this.closeModalDropdowns();
    this.modalOpenSupervisorDrop.set(true);
    this.fetchModalSupervisors(this.modalSupervisorSearch());
  }

  onModalSupervisorSearch(value: string): void {
    this.modalSupervisorSearch.set(value);
    this.modalSupervisorSearch$.next(value);
  }

  selectModalSupervisor(supervisor: SupervisorDropdownItem): void {
    this.modalSupervisorId.set(supervisor.UserId);
    this.modalSupervisorName.set(supervisor.Name);
    this.modalOpenSupervisorDrop.set(false);
  }

  clearModalSupervisor(): void {
    this.modalSupervisorId.set('');
    this.modalSupervisorName.set('');
    this.modalSupervisorSearch.set('');
    this.modalSupervisorList.set([]);
  }

  submitAssign(): void {
    const complaintId = this.assigningComplaintId();
    const supervisorId = this.modalSupervisorId();
    if (!complaintId || !supervisorId || this.assignSubmitting()) return;

    this.assignSubmitting.set(true);
    this.complaintsService.assignSupervisor(complaintId, supervisorId)
      .pipe(
        finalize(() => this.assignSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.IsSuccess) {
            this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذر إسناد المشرف' });
            return;
          }
          this.toast.add({ severity: 'success', summary: 'تم', detail: 'تم إسناد المشرف بنجاح' });
          this.closeAssignModal();
          this.loadComplaints(true);
        },
        error: () => this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذر إسناد المشرف' }),
      });
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

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadComplaints();
  }

  campaignFilterLabel(): string {
    return this.selectedCampaignName() || 'جميع المراكز';
  }

  groupFilterLabel(): string {
    return this.selectedGroupName() || (this.selectedCampaignId() ? 'جميع المجموعات' : 'اختر المركز أولا');
  }

  statusLabel(status: ComplaintStatus): string {
    switch (status) {
      case ComplaintStatus.Open: return 'مفتوحة';
      case ComplaintStatus.Solved: return 'تم حلها';
      case ComplaintStatus.Closed: return 'مغلقة بدون حل';
    }
  }

  statusBadgeClass(status: ComplaintStatus): string {
    switch (status) {
      case ComplaintStatus.Open: return 'badge badge--open';
      case ComplaintStatus.Solved: return 'badge badge--solved';
      case ComplaintStatus.Closed: return 'badge badge--closed';
      default: return 'badge';
    }
  }

  statusIcon(status: ComplaintStatus): string {
    switch (status) {
      case ComplaintStatus.Open: return 'pi pi-list';
      case ComplaintStatus.Solved: return 'pi pi-check-circle';
      case ComplaintStatus.Closed: return 'pi pi-times-circle';
      default: return '';
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(value));
  }

  private fetchCampaigns(companyId: string): void {
    this.campaignLoading.set(true);
    this.complaintsService.getCampaigns(companyId)
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
    this.complaintsService.getGroups(campaignId)
      .pipe(
        finalize(() => this.groupLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.groupList.set(res.Data?.Items ?? []);
      });
  }

  private fetchSupervisors(search?: string): void {
    const companyId = this.currentCompanyId();
    if (!companyId) {
      this.supervisorList.set([]);
      return;
    }

    this.supervisorLoading.set(true);
    this.complaintsService.getSupervisors(this.selectedGroupId(), companyId, search)
      .pipe(
        finalize(() => this.supervisorLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => { if (res.IsSuccess) this.supervisorList.set(res.Data ?? []); },
        error: () => this.supervisorList.set([]),
      });
  }

  private fetchModalCampaigns(companyId: string): void {
    this.modalCampaignLoading.set(true);
    this.complaintsService.getCampaigns(companyId)
      .pipe(
        finalize(() => this.modalCampaignLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.modalCampaignList.set(res.Data ?? []);
      });
  }

  private fetchModalGroups(campaignId: string): void {
    this.modalGroupLoading.set(true);
    this.complaintsService.getGroups(campaignId)
      .pipe(
        finalize(() => this.modalGroupLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.IsSuccess) this.modalGroupList.set(res.Data?.Items ?? []);
      });
  }

  private fetchModalSupervisors(search?: string): void {
    const companyId = this.currentCompanyId();
    if (!companyId) {
      this.modalSupervisorList.set([]);
      return;
    }

    this.modalSupervisorLoading.set(true);
    this.complaintsService.getSupervisors(this.modalGroupId(), companyId, search)
      .pipe(
        finalize(() => this.modalSupervisorLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => { if (res.IsSuccess) this.modalSupervisorList.set(res.Data ?? []); },
        error: () => this.modalSupervisorList.set([]),
      });
  }

  private loadComplaints(silent = false): void {
    const companyId = this.currentCompanyId();
    if (!companyId) {
      this.reset();
      return;
    }

    if (!silent) this.loading.set(true);
    this.complaintsService.getComplaints({
      CompanyId: companyId,
      CampaignId: this.selectedCampaignId() || undefined,
      GroupId: this.selectedGroupId() || undefined,
      SupervisorId: this.selectedSupervisorId() || undefined,
      StatusFilter: this.selectedStatusFilter() !== null ? (this.selectedStatusFilter() as number) : undefined,
      PageNumber: this.currentPage(),
      PageSize: this.pageSize(),
    })
      .pipe(
        finalize(() => { if (!silent) this.loading.set(false); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.IsSuccess) { this.reset(); return; }
          const d = res.Data;
          this.openCount.set(d?.OpenCount ?? 0);
          this.solvedCount.set(d?.SolvedCount ?? 0);
          this.closedCount.set(d?.ClosedCount ?? 0);
          this.complaints.set(d?.Complaints?.Items ?? []);
          this.listTotalCount.set(d?.Complaints?.TotalCount ?? 0);
          this.totalPages.set(d?.Complaints?.TotalPages ?? 0);
          this.currentPage.set(d?.Complaints?.CurrentPage ?? 1);
          this.hasNext.set(d?.Complaints?.HasNext ?? false);
          this.hasPrevious.set(d?.Complaints?.HasPrevious ?? false);
        },
        error: () => this.reset(),
      });
  }

  private reset(): void {
    this.complaints.set([]);
    this.openCount.set(0);
    this.solvedCount.set(0);
    this.closedCount.set(0);
    this.listTotalCount.set(0);
    this.totalPages.set(0);
    this.hasNext.set(false);
    this.hasPrevious.set(false);
  }

  private currentCompanyId(): string {
    return this.auth.currentUser()?.companyId ?? '';
  }
}
