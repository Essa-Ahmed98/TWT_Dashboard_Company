import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { DatePicker } from 'primeng/datepicker';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { SupervisorsService } from './supervisors.service';
import { SupervisorItem, SupervisorForm, CreateSupervisorRequest, LANGUAGE_OPTIONS } from './supervisors.model';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { ApiResult } from '../../core/models/api.models';
import { AuthService } from '../../core/auth/services/auth';
import { CampaignsService } from '../campaigns/campaigns.service';
import { environment } from '../../../environments/environment';
import { MessageService } from 'primeng/api';
import { exportRowsToExcel } from '../../core/utils/excel-export';

const EMPTY_FORM: SupervisorForm = {
  email: '', displayName: '', phone: '+966', password: '',
  campaignId: '', groupId: '',
  passportNumber: '', nationality: '', dateOfBirth: '',
  gender: '', specialization: '', yearsOfExperience: '',
  languages: [], notes: '',
};

@Component({
  selector:    'app-supervisors',
  imports:     [ProgressSpinnerModule, FormsModule, DatePicker, DecimalPipe],
  templateUrl: './supervisors.html',
  styleUrl:    './supervisors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Supervisors implements OnInit {
  private readonly service          = inject(SupervisorsService);
  private readonly router           = inject(Router);
  private readonly http             = inject(HttpClient);
  private readonly auth             = inject(AuthService);
  private readonly campaignsService = inject(CampaignsService);
  private readonly destroyRef       = inject(DestroyRef);
  private readonly toast            = inject(MessageService);

  // ── List state ───────────────────────────────────────────────────
  supervisors  = signal<SupervisorItem[]>([]);
  loading      = signal(false);
  pageSize     = signal(10);
  onlineCount  = signal(0);
  pilgrimCount = signal(0);
  totalCount   = signal(0);
  totalPages   = signal(0);
  currentPage  = signal(1);
  hasNext      = signal(false);
  hasPrevious  = signal(false);
  searchQuery  = signal('');
  statusFilter = signal<number | undefined>(undefined);

  private readonly search$ = new Subject<string>();

  // ── Modal state ──────────────────────────────────────────────────
  showModal   = signal(false);
  submitting  = signal(false);
  submitError = signal<string | null>(null);
  formData    = signal<SupervisorForm>({ ...EMPTY_FORM });

  // Campaigns dropdown
  campList         = signal<CampaignApiItem[]>([]);
  campLoading      = signal(false);
  showCampDrop     = signal(false);
  selectedCampName = signal('');

  // Groups dropdown
  grpList          = signal<GroupApiItem[]>([]);
  grpLoading       = signal(false);
  showGrpDrop      = signal(false);
  selectedGrpName  = signal('');

  // Languages multi-select
  showLangDrop     = signal(false);
  readonly languageOptions = LANGUAGE_OPTIONS;

  // ── Lifecycle ────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.currentPage.set(1); this.load(); });
  }

  // ── List ─────────────────────────────────────────────────────────
  private load(): void {
    this.loading.set(true);
    this.service
      .getSupervisors({ pageNumber: this.currentPage(), pageSize: this.pageSize(), search: this.searchQuery() || undefined, status: this.statusFilter() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) {
            const d = res.Data;
            this.supervisors.set(d.Supervisors.Items);
            this.totalCount.set(d.Supervisors.TotalCount);
            this.totalPages.set(d.Supervisors.TotalPages);
            this.currentPage.set(d.Supervisors.CurrentPage);
            this.hasNext.set(d.Supervisors.HasNext);
            this.hasPrevious.set(d.Supervisors.HasPrevious);
            this.onlineCount.set(d.OnlineCount);
            this.pilgrimCount.set(d.PilgrimCount);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(value: string): void { this.searchQuery.set(value); this.search$.next(value); }
  goToPage(page: number): void  { if (page < 1 || page > this.totalPages()) return; this.currentPage.set(page); this.load(); }
  nextPage(): void  { this.goToPage(this.currentPage() + 1); }
  prevPage(): void  { this.goToPage(this.currentPage() - 1); }
  goToDetail(id: string): void  { this.router.navigate(['/supervisors', id]); }

  openChat(userId: string, displayName?: string): void {
    this.router.navigate(['/chat'], { queryParams: { userId }, state: { displayName } });
  }
  onlineClass(item: SupervisorItem): string { return item.IsOnline ? 'online' : 'offline'; }

  readonly lastItem = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalCount())
  );

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

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  // ── Modal open / close ────────────────────────────────────────────
  openModal(): void {
    this.formData.set({ ...EMPTY_FORM, languages: [] });
    this.submitError.set(null);
    this.selectedCampName.set('');
    this.selectedGrpName.set('');
    this.campList.set([]);
    this.grpList.set([]);
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
    this.showLangDrop.set(false);
    this.showModal.set(true);
  }

  closeModal(): void { if (this.submitting()) return; this.showModal.set(false); }

  patchForm(patch: Partial<SupervisorForm>): void {
    this.formData.update(f => ({ ...f, ...patch }));
  }

  closeAllDrops(): void {
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
    this.showLangDrop.set(false);
  }

  // ── Campaigns dropdown ────────────────────────────────────────────
  private fetchCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;
    this.campLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { this.campList.set(data); this.campLoading.set(false); });
  }

  toggleCampDrop(): void {
    if (this.showCampDrop()) { this.showCampDrop.set(false); return; }
    this.showGrpDrop.set(false);
    this.showLangDrop.set(false);
    this.showCampDrop.set(true);
    if (this.campList().length === 0) this.fetchCampaigns();
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

  // ── Groups dropdown ───────────────────────────────────────────────
  private fetchGroups(campaignId: string): void {
    this.grpLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(finalize(() => this.grpLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => { if (res.IsSuccess) this.grpList.set(res.Data); });
  }

  toggleGrpDrop(): void {
    if (!this.formData().campaignId) return;
    if (this.showGrpDrop()) { this.showGrpDrop.set(false); return; }
    this.showCampDrop.set(false);
    this.showLangDrop.set(false);
    this.showGrpDrop.set(true);
    if (this.grpList().length === 0) this.fetchGroups(this.formData().campaignId);
  }

  selectGrp(g: GroupApiItem): void {
    this.patchForm({ groupId: g.Id });
    this.selectedGrpName.set(g.Name);
    this.showGrpDrop.set(false);
  }

  clearGrp(): void { this.patchForm({ groupId: '' }); this.selectedGrpName.set(''); }

  // ── Languages multi-select ────────────────────────────────────────
  toggleLangDrop(): void {
    if (this.showLangDrop()) { this.showLangDrop.set(false); return; }
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
    this.showLangDrop.set(true);
  }

  toggleLanguage(value: number): void {
    const langs = this.formData().languages;
    const updated = langs.includes(value) ? langs.filter(v => v !== value) : [...langs, value];
    this.patchForm({ languages: updated });
  }

  isLangSelected(value: number): boolean { return this.formData().languages.includes(value); }

  langLabels(langs: number[] | null | undefined): string {
    if (!langs?.length) return '—';
    return langs
      .map(v => LANGUAGE_OPTIONS.find(o => o.value === v)?.label ?? String(v))
      .join('، ');
  }

  langTriggerLabel(): string {
    const langs = this.formData().languages;
    if (langs.length === 0) return '';
    return langs.map(v => LANGUAGE_OPTIONS.find(o => o.value === v)?.label ?? '').join('، ');
  }

  // ── Submit ────────────────────────────────────────────────────────
  submitForm(): void {
    const f = this.formData();
    const req: CreateSupervisorRequest = {
      Email:             f.email,
      DisplayName:       f.displayName.trim(),
      Phone:             f.phone,
      Password:          f.password,
      CompanyId:         this.auth.currentUser()?.companyId ?? '',
      CampaignId:        f.campaignId,
      GroupId:           f.groupId,
      PassportNumber:    f.passportNumber,
      Nationality:       f.nationality,
      DateOfBirth:       f.dateOfBirth ? new Date(f.dateOfBirth).toISOString() : '',
      Gender:            f.gender !== '' ? +f.gender : 0,
      Specialization:    f.specialization,
      YearsOfExperience: f.yearsOfExperience !== '' ? +f.yearsOfExperience : 0,
      Languages:         f.languages,
      Notes:             f.notes,
    };

    this.submitting.set(true);
    this.submitError.set(null);

    this.service.createSupervisor(req)
      .pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) { this.showModal.set(false); this.load(); }
          else { this.submitError.set('حدث خطأ أثناء إضافة المشرف'); }
        },
        error: () => this.submitError.set('حدث خطأ أثناء إضافة المشرف'),
      });
  }

  isFormValid(): boolean {
    const f = this.formData();
    return !!(
      f.displayName.trim() &&
      f.email.trim()       &&
      f.phone.trim()       &&
      f.password.trim()    &&
      f.campaignId         &&
      f.groupId            &&
      f.passportNumber.trim() &&
      f.nationality.trim() &&
      f.dateOfBirth        &&
      f.gender !== ''      &&
      f.languages.length > 0
    );
  }

  exportCurrentList(): void {
    const items = this.supervisors();
    if (items.length === 0) {
      this.toast.add({
        severity: 'warn',
        summary: 'لا توجد بيانات',
        detail: 'لا توجد بيانات معروضة لتصديرها.',
      });
      return;
    }

    exportRowsToExcel(
      'supervisors-list',
      ['المشرف', 'الحملة', 'المجموعة', 'رقم الجواز', 'الجنسية', 'اللغات', 'الحالة'],
      items.map(s => [
        s.DisplayName || s.UserId,
        s.CampaignName || s.CampaignId || '—',
        s.GroupName || '—',
        s.PassportNumber || '—',
        s.Nationality || '—',
        this.langLabels(s.Languages),
        s.IsOnline ? 'متصل' : 'غير متصل',
      ]),
    );
  }
}
