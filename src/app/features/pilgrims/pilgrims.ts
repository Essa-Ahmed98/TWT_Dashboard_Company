import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, finalize, skip } from 'rxjs';
import { DatePicker } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { BLOOD_TYPE_OPTIONS, CreatePilgrimRequest, PilgrimForm } from './pilgrims.model';
import { PilgrimsService } from './pilgrims.service';
import { AuthService } from '../../core/auth/services/auth';
import { CampaignsService } from '../campaigns/campaigns.service';
import { exportRowsToExcel } from '../../core/utils/excel-export';

const EMPTY_FORM: PilgrimForm = {
  displayName: '',
  email: '',
  phone: '+966',
  campaignId: '',
  groupId: '',
  passportNumber: '',
  nationality: '',
  dateOfBirth: '',
  gender: '',
  idNumber: '',
  accommodation: '',
  ritualCardNumber: '',
  permitNumber: '',
  bloodType: '',
};

@Component({
  selector: 'app-pilgrims',
  imports: [FormsModule, DatePicker, DecimalPipe],
  templateUrl: './pilgrims.html',
  styleUrl: './pilgrims.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pilgrims implements OnInit {
  private readonly service = inject(PilgrimsService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly campaignsService = inject(CampaignsService);
  private readonly toast = inject(MessageService);

  readonly bloodTypeOptions = BLOOD_TYPE_OPTIONS;

  readonly list = this.service.list;
  readonly loading = this.service.loading;
  readonly total = this.service.total;
  readonly totalPages = this.service.totalPages;
  readonly page = this.service.page;

  pageSize = signal(20);

  lastItem = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total())
  );

  visiblePages = computed<(number | '...')[]>(() => {
    const total   = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3)         pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  filterCampList = signal<CampaignApiItem[]>([]);
  filterCampLoading = signal(false);
  searchQuery = signal('');
  selectedCampaign = signal(this.route.snapshot.queryParamMap.get('campaign') ?? '');
  openFilterDrop = signal(false);

  showModal = signal(false);
  submitting = signal(false);
  submitError = signal<string | null>(null);
  formData = signal<PilgrimForm>({ ...EMPTY_FORM });

  showImportModal = signal(false);
  importSelectedFileName = signal('');
  importCampList = signal<CampaignApiItem[]>([]);
  importCampLoading = signal(false);
  showImportCampDrop = signal(false);
  selectedImportCampId = signal('');
  selectedImportCampName = signal('');
  importGrpList = signal<GroupApiItem[]>([]);
  importGrpLoading = signal(false);
  showImportGrpDrop = signal(false);
  selectedImportGrpId = signal('');
  selectedImportGrpName = signal('');
  downloadingTemplate = signal(false);
  importSelectedFile = signal<File | null>(null);
  uploadingImportFile = signal(false);

  campList = signal<CampaignApiItem[]>([]);
  campLoading = signal(false);
  showCampDrop = signal(false);
  selectedCampName = signal('');

  grpList = signal<GroupApiItem[]>([]);
  grpLoading = signal(false);
  showGrpDrop = signal(false);
  selectedGrpName = signal('');

  constructor() {
    toObservable(this.searchQuery)
      .pipe(debounceTime(400), skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPilgrims(1));
  }

  ngOnInit(): void {
    this.fetchFilterCampaigns();
    this.loadPilgrims(1);
  }

  private loadPilgrims(pageNumber: number): void {
    this.service.loadForAdmin({
      Search: this.searchQuery().trim() || undefined,
      CampaignId: this.selectedCampaign() || undefined,
      PageNumber: pageNumber,
      PageSize: this.pageSize(),
    });
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.loadPilgrims(1);
  }

  openDetail(id: string): void {
    this.router.navigate(['/pilgrims', id]);
  }

  openChat(userId: string, displayName?: string): void {
    this.router.navigate(['/chat'], { queryParams: { userId }, state: { displayName } });
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) this.loadPilgrims(p);
  }

  toggleFilterDrop(e: Event): void {
    e.stopPropagation();
    this.openFilterDrop.update(v => !v);
  }

  closeFilterDrop(): void {
    this.openFilterDrop.set(false);
  }

  selectFilterCampaign(id: string): void {
    this.selectedCampaign.set(id);
    this.openFilterDrop.set(false);
    this.loadPilgrims(1);
  }

  filterCampaignLabel(): string {
    const c = this.filterCampList().find(x => x.Id === this.selectedCampaign());
    return c ? c.Name : 'كل الحملات';
  }

  private fetchFilterCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.filterCampLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.filterCampList.set(data);
        this.filterCampLoading.set(false);
      });
  }

  openModal(): void {
    this.formData.set({ ...EMPTY_FORM });
    this.submitError.set(null);
    this.selectedCampName.set('');
    this.selectedGrpName.set('');
    this.campList.set([]);
    this.grpList.set([]);
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.showModal.set(false);
  }

  openImportModal(): void {
    this.showImportModal.set(true);
    this.importSelectedFileName.set('');
    this.importSelectedFile.set(null);
    this.importCampList.set([]);
    this.importGrpList.set([]);
    this.importCampLoading.set(false);
    this.importGrpLoading.set(false);
    this.showImportCampDrop.set(false);
    this.showImportGrpDrop.set(false);
    this.selectedImportCampId.set('');
    this.selectedImportCampName.set('');
    this.selectedImportGrpId.set('');
    this.selectedImportGrpName.set('');
  }

  closeImportModal(): void {
    if (this.uploadingImportFile()) return;
    this.showImportModal.set(false);
  }

  patchForm(patch: Partial<PilgrimForm>): void {
    this.formData.update(f => ({ ...f, ...patch }));
  }

  private fetchCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.campLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.campList.set(data);
        this.campLoading.set(false);
      });
  }

  private fetchImportCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.importCampLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.importCampList.set(data);
        this.importCampLoading.set(false);
      });
  }

  toggleCampDrop(): void {
    if (this.showCampDrop()) {
      this.showCampDrop.set(false);
    } else {
      this.showCampDrop.set(true);
      if (this.campList().length === 0) this.fetchCampaigns();
    }
  }

  selectCamp(c: CampaignApiItem): void {
    this.patchForm({ campaignId: c.Id, groupId: '' });
    this.selectedCampName.set(c.Name);
    this.selectedGrpName.set('');
    this.showCampDrop.set(false);
    this.grpList.set([]);
  }

  clearCamp(): void {
    this.patchForm({ campaignId: '', groupId: '' });
    this.selectedCampName.set('');
    this.selectedGrpName.set('');
    this.grpList.set([]);
  }

  toggleImportCampDrop(): void {
    if (this.showImportCampDrop()) {
      this.showImportCampDrop.set(false);
    } else {
      this.showImportCampDrop.set(true);
      if (this.importCampList().length === 0) this.fetchImportCampaigns();
    }
  }

  selectImportCamp(c: CampaignApiItem): void {
    this.selectedImportCampId.set(c.Id);
    this.selectedImportCampName.set(c.Name);
    this.selectedImportGrpId.set('');
    this.selectedImportGrpName.set('');
    this.importGrpList.set([]);
    this.showImportCampDrop.set(false);
  }

  clearImportCamp(): void {
    this.selectedImportCampId.set('');
    this.selectedImportCampName.set('');
    this.selectedImportGrpId.set('');
    this.selectedImportGrpName.set('');
    this.importGrpList.set([]);
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

  private fetchImportGroups(campaignId: string): void {
    this.importGrpLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(finalize(() => this.importGrpLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        if (res.IsSuccess) this.importGrpList.set(res.Data);
      });
  }

  toggleGrpDrop(): void {
    if (!this.formData().campaignId) return;

    if (this.showGrpDrop()) {
      this.showGrpDrop.set(false);
    } else {
      this.showGrpDrop.set(true);
      if (this.grpList().length === 0) this.fetchGroups(this.formData().campaignId);
    }
  }

  selectGrp(g: GroupApiItem): void {
    this.patchForm({ groupId: g.Id });
    this.selectedGrpName.set(g.Name);
    this.showGrpDrop.set(false);
  }

  clearGrp(): void {
    this.patchForm({ groupId: '' });
    this.selectedGrpName.set('');
  }

  toggleImportGrpDrop(): void {
    if (!this.selectedImportCampId()) return;

    if (this.showImportGrpDrop()) {
      this.showImportGrpDrop.set(false);
    } else {
      this.showImportGrpDrop.set(true);
      if (this.importGrpList().length === 0) this.fetchImportGroups(this.selectedImportCampId());
    }
  }

  selectImportGrp(g: GroupApiItem): void {
    this.selectedImportGrpId.set(g.Id);
    this.selectedImportGrpName.set(g.Name);
    this.showImportGrpDrop.set(false);
  }

  clearImportGrp(): void {
    this.selectedImportGrpId.set('');
    this.selectedImportGrpName.set('');
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.importSelectedFile.set(file ?? null);
    this.importSelectedFileName.set(file?.name ?? '');
  }

  handleImportUpload(fileInput: HTMLInputElement): void {
    if (this.uploadingImportFile()) return;

    const selectedFile = this.importSelectedFile();
    if (!selectedFile) {
      fileInput.click();
      return;
    }

    this.uploadingImportFile.set(true);

    this.service.uploadPilgrimsFile(selectedFile, 'ar')
      .pipe(finalize(() => this.uploadingImportFile.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          const isSuccess = (response as ApiResult<unknown>)?.IsSuccess ?? (response as { issuccess?: boolean; IsSuccess?: boolean })?.issuccess ?? false;

          if (isSuccess) {
            this.closeImportModalAfterSuccess(fileInput);
            return;
          }

          this.showImportError();
        },
        error: () => this.showImportError(),
      });
  }

  private closeImportModalAfterSuccess(fileInput: HTMLInputElement): void {
    this.showImportModal.set(false);
    this.importSelectedFile.set(null);
    this.importSelectedFileName.set('');
    fileInput.value = '';
    this.loadPilgrims(1);
  }

  private showImportError(): void {
    this.toast.add({
      severity: 'error',
      summary: 'خطأ',
      detail: 'فيه مشكلة ولم نتمكن من تنفيذ العملية',
    });
  }

  downloadImportTemplate(): void {
    if (!this.selectedImportCampId() || !this.selectedImportGrpId()) {
      this.toast.add({
        severity: 'warn',
        summary: 'بيانات ناقصة',
        detail: 'اختر الحملة والمجموعة أولاً لتحميل النموذج.',
      });
      return;
    }

    this.downloadingTemplate.set(true);

    this.service.downloadTemplate(this.selectedImportCampId(), this.selectedImportGrpId(), 'ar')
      .pipe(finalize(() => this.downloadingTemplate.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          const blob = response.body;
          if (!blob) {
            this.toast.add({
              severity: 'error',
              summary: 'تعذر التحميل',
              detail: 'لم يتم استلام ملف النموذج من الخادم.',
            });
            return;
          }

          const fileName = this.extractFileName(response.headers.get('content-disposition'))
            || `pilgrims-template-${this.selectedImportGrpId()}.xlsx`;

          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.click();
          anchor.remove();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.toast.add({
            severity: 'error',
            summary: 'فشل التحميل',
            detail: 'حدث خطأ أثناء تحميل نموذج Excel.',
          });
        },
      });
  }

  private extractFileName(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return plainMatch?.[1] ?? null;
  }

  submitForm(): void {
    const f = this.formData();
    if (!f.displayName.trim() || !f.campaignId) return;

    const req: CreatePilgrimRequest = {
      Email: f.email,
      DisplayName: f.displayName.trim(),
      Phone: f.phone,
      CompanyId: this.auth.currentUser()?.companyId ?? '',
      CampaignId: f.campaignId,
      GroupId: f.groupId,
      PassportNumber: f.passportNumber,
      Nationality: f.nationality,
      DateOfBirth: f.dateOfBirth ? new Date(f.dateOfBirth).toISOString() : '',
      Gender: f.gender !== '' ? +f.gender : 0,
      IDNumber: f.idNumber,
      Accommodation: f.accommodation,
      RitualCardNumber: f.ritualCardNumber,
      PermitNumber: f.permitNumber,
      BloodType: f.bloodType !== '' ? +f.bloodType : 0,
    };

    this.submitting.set(true);
    this.submitError.set(null);

    this.service.createPilgrim(req)
      .pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) {
            this.showModal.set(false);
            this.loadPilgrims(1);
          } else {
            this.submitError.set('حدث خطأ أثناء إضافة الحاج');
          }
        },
        error: () => this.submitError.set('حدث خطأ أثناء إضافة الحاج'),
      });
  }

  isFormValid(): boolean {
    const f = this.formData();
    return !!(
      f.displayName.trim() &&
      f.email.trim() &&
      f.phone.trim() &&
      f.campaignId &&
      f.groupId &&
      f.passportNumber.trim() &&
      f.nationality.trim() &&
      f.dateOfBirth &&
      f.gender !== '' &&
      f.idNumber.trim() &&
      f.accommodation.trim() &&
      f.ritualCardNumber.trim() &&
      f.permitNumber.trim() &&
      f.bloodType !== ''
    );
  }

  exportCurrentList(): void {
    const items = this.list();
    if (items.length === 0) {
      this.toast.add({
        severity: 'warn',
        summary: 'لا توجد بيانات',
        detail: 'لا توجد بيانات معروضة لتصديرها.',
      });
      return;
    }

    exportRowsToExcel(
      'pilgrims-list',
      ['الحاج', 'الحملة', 'المجموعة', 'رقم الجواز', 'الجنسية', 'الجنس'],
      items.map(p => [
        p.DisplayName,
        p.CampaignName,
        p.GroupName,
        p.PassportNumber,
        p.Nationality,
        this.genderLabel(p.Gender),
      ]),
    );
  }

  genderLabel(gender: number): string {
    return gender === 0 ? 'ذكر' : 'أنثى';
  }
}
