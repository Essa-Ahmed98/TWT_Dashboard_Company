import { DatePipe, DecimalPipe, NgClass, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { DelegateListItem, PilgrimRequest } from './jamarat-delegates.model';
import { JamaratDelegatesService } from './jamarat-delegates.service';

interface DelegateFormControls {
  DisplayName: FormControl<string>;
  IdNumber: FormControl<string>;
  Phone: FormControl<string>;
  Age: FormControl<number | null>;
  Email: FormControl<string>;
  Password: FormControl<string>;
  Nationality: FormControl<string>;
  Affiliation: FormControl<string>;
  WorkFrom: FormControl<string>;
  WorkTo: FormControl<string>;
  MaxConcurrent: FormControl<number | null>;
  IsAvailable: FormControl<boolean>;
  Notes: FormControl<string>;
}

type DelegateForm = FormGroup<DelegateFormControls>;

type ActiveTab = 'delegates' | 'requests';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const T = (key: string) => `JAMARAT_DELEGATES.${key}`;

@Component({
  selector: 'app-jamarat-delegates',
  imports: [
    DatePipe,
    DecimalPipe,
    NgClass,
    Dialog,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
  templateUrl: './jamarat-delegates.html',
  styleUrl: './jamarat-delegates.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JamaratDelegates implements OnInit {
  private readonly service = inject(JamaratDelegatesService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly affiliationOptions = [
    { value: '', labelKey: T('AFFILIATION_ALL') },
    { value: 'جمعية', labelKey: T('AFFILIATION_ASSOCIATION') },
    { value: 'بعثة', labelKey: T('AFFILIATION_MISSION') },
  ];

  readonly activeTab = signal<ActiveTab>('delegates');

  // List state
  readonly delegates = signal<DelegateListItem[]>([]);
  readonly listLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly currentPage = signal(1);
  readonly pageSize = signal<number>(10);

  // Filters
  readonly searchText = signal('');
  readonly affiliationFilter = signal('');
  private readonly search$ = new Subject<string>();

  // Dialog state
  readonly showDialog = signal(false);
  readonly savingDelegate = signal(false);
  readonly loadingDelegateDetails = signal(false);
  readonly formSubmitted = signal(false);
  readonly backendErrors = signal<string[]>([]);
  readonly showPassword = signal(false);
  readonly selectedDelegate = signal<DelegateListItem | null>(null);
  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);

  // Pilgrim requests state
  readonly requests = signal<PilgrimRequest[]>([]);
  readonly requestsLoading = signal(false);
  readonly requestsError = signal<string | null>(null);
  readonly requestsTotal = signal(0);

  readonly delegateForm: DelegateForm = new FormGroup<DelegateFormControls>({
    DisplayName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    IdNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{10}$/)] }),
    Phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    Age: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1)] }),
    Email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    Password: new FormControl('', { nonNullable: true }),
    Nationality: new FormControl('', { nonNullable: true }),
    Affiliation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    WorkFrom: new FormControl('08:00', { nonNullable: true }),
    WorkTo: new FormControl('17:00', { nonNullable: true }),
    MaxConcurrent: new FormControl<number | null>(3, { validators: [Validators.min(0)] }),
    IsAvailable: new FormControl(true, { nonNullable: true }),
    Notes: new FormControl('', { nonNullable: true }),
  });

  readonly isEditMode = computed(() => !!this.selectedDelegate());

  readonly availableNowCount = computed(() => this.delegates().filter(d => d.Work?.IsAvailable).length);
  readonly activeRequestsCount = computed(
    () => this.delegates().reduce((sum, d) => sum + (d.Stats?.ActiveRequests ?? 0), 0),
  );

  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  ngOnInit(): void {
    this.delegateForm.addValidators(this.workRangeValidator);

    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(text => {
        this.searchText.set(text);
        this.currentPage.set(1);
        this.loadDelegates();
      });

    this.loadDelegates();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(T(key), params);
  }

  // ── Data ─────────────────────────────────────────────────────
  loadDelegates(): void {
    this.listLoading.set(true);
    this.loadError.set(null);

    this.service.getDelegates({
      searchText: this.searchText() || undefined,
      affiliation: this.affiliationFilter() || undefined,
      pageNumber: this.currentPage(),
      pageSize: this.pageSize(),
    })
      .pipe(finalize(() => this.listLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            const message = this.resolveApiErrorMessage(res, this.t('MSG_LOAD_LIST_FAIL'));
            this.delegates.set([]);
            this.totalCount.set(0);
            this.totalPages.set(1);
            this.loadError.set(message);
            this.toast.add({ severity: 'error', summary: this.t('TOAST_ERROR'), detail: message });
            return;
          }

          const data = res.Data;
          this.delegates.set(data?.Items ?? []);
          this.totalCount.set(data?.TotalCount ?? 0);
          this.totalPages.set(Math.max(data?.TotalPages ?? 1, 1));
        },
        error: err => {
          const message = this.resolveApiErrorMessage(err?.error, this.t('MSG_LOAD_LIST_FAIL'));
          this.delegates.set([]);
          this.totalCount.set(0);
          this.totalPages.set(1);
          this.loadError.set(message);
          this.toast.add({ severity: 'error', summary: this.t('TOAST_ERROR'), detail: message });
        },
      });
  }

  // ── Filters ──────────────────────────────────────────────────
  onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  onAffiliationChange(value: string): void {
    this.affiliationFilter.set(value);
    this.currentPage.set(1);
    this.loadDelegates();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadDelegates();
  }

  // ── Pagination ───────────────────────────────────────────────
  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadDelegates();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadDelegates();
    }
  }

  goToPage(page: number): void {
    if (page !== this.currentPage()) {
      this.currentPage.set(page);
      this.loadDelegates();
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────
  setTab(tab: ActiveTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    if (tab === 'delegates') {
      this.loadDelegates();
    } else {
      this.loadRequests();
    }
  }

  loadRequests(): void {
    this.requestsLoading.set(true);
    this.requestsError.set(null);

    this.service.getRequests()
      .pipe(finalize(() => this.requestsLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            const message = this.resolveApiErrorMessage(res, this.t('MSG_LOAD_REQUESTS_FAIL'));
            this.requests.set([]);
            this.requestsTotal.set(0);
            this.requestsError.set(message);
            this.toast.add({ severity: 'error', summary: this.t('TOAST_ERROR'), detail: message });
            return;
          }
          this.requests.set(res.Data?.Requests ?? []);
          this.requestsTotal.set(res.Data?.TotalCount ?? 0);
        },
        error: err => {
          const message = this.resolveApiErrorMessage(err?.error, this.t('MSG_LOAD_REQUESTS_FAIL'));
          this.requests.set([]);
          this.requestsTotal.set(0);
          this.requestsError.set(message);
          this.toast.add({ severity: 'error', summary: this.t('TOAST_ERROR'), detail: message });
        },
      });
  }

  requestStatusKey(status: string): string {
    const key = (status ?? '').toLowerCase();
    if (key === 'pending') return T('STATUS_PENDING');
    if (key === 'accepted') return T('STATUS_ACCEPTED');
    if (key === 'completed') return T('STATUS_COMPLETED');
    if (key === 'rejected') return T('STATUS_REJECTED');
    if (key === 'cancelled' || key === 'canceled') return T('STATUS_CANCELLED');
    return '';
  }

  requestStatusFallback(status: string): string {
    return status || '—';
  }

  requestStatusClass(status: string): string {
    const key = (status ?? '').toLowerCase();
    if (key === 'completed' || key === 'accepted') return 'status-badge--active';
    if (key === 'rejected' || key === 'cancelled' || key === 'canceled') return 'status-badge--inactive';
    return 'status-badge--pending';
  }

  // ── Add / Edit ───────────────────────────────────────────────
  openAddDialog(): void {
    this.selectedDelegate.set(null);
    this.resetForm();
    this.delegateForm.controls.Password.setValidators([Validators.required]);
    this.delegateForm.controls.Password.updateValueAndValidity();
    this.showDialog.set(true);
  }

  openEditDialog(delegate: DelegateListItem): void {
    this.selectedDelegate.set(delegate);
    this.resetForm();
    this.delegateForm.controls.Password.clearValidators();
    this.delegateForm.controls.Password.updateValueAndValidity();

    this.loadingDelegateDetails.set(true);
    this.showDialog.set(true);

    this.service.getDelegateById(delegate.DelegateId)
      .pipe(
        finalize(() => this.loadingDelegateDetails.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.patchFormFromDelegate(delegate);
            this.toast.add({
              severity: 'warn',
              summary: this.t('TOAST_WARNING'),
              detail: this.resolveApiErrorMessage(res, this.t('MSG_LOAD_DETAILS_FAIL')),
            });
            return;
          }
          this.patchFormFromDelegate(res.Data ?? delegate);
        },
        error: err => {
          this.patchFormFromDelegate(delegate);
          this.toast.add({
            severity: 'warn',
            summary: this.t('TOAST_WARNING'),
            detail: this.resolveApiErrorMessage(err?.error, this.t('MSG_LOAD_DETAILS_FAIL')),
          });
        },
      });
  }

  closeDialog(): void {
    if (this.savingDelegate()) return;
    this.showDialog.set(false);
    this.selectedDelegate.set(null);
    this.resetForm();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.imageFile.set(file);
    if (isPlatformBrowser(this.platformId)) {
      const reader = new FileReader();
      reader.onload = () => this.imagePreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  clearImage(): void {
    this.imageFile.set(null);
    this.imagePreview.set(null);
  }

  submitDelegate(): void {
    this.formSubmitted.set(true);
    this.backendErrors.set([]);

    if (this.delegateForm.invalid || this.savingDelegate()) {
      this.delegateForm.markAllAsTouched();
      return;
    }

    const value = this.delegateForm.getRawValue();
    const selected = this.selectedDelegate();

    const formData = new FormData();
    if (selected) {
      formData.append('DelegateId', selected.DelegateId);
      if (selected.UserId) formData.append('UserId', selected.UserId);
    }
    formData.append('DisplayName', value.DisplayName.trim());
    formData.append('IdNumber', value.IdNumber.trim());
    formData.append('Phone', value.Phone.trim());
    formData.append('Age', String(value.Age ?? ''));
    if (value.Email.trim()) formData.append('Email', value.Email.trim());
    if (!selected && value.Password) formData.append('Password', value.Password);
    if (value.Nationality.trim()) formData.append('Nationality', value.Nationality.trim());
    if (value.Affiliation.trim()) formData.append('Affiliation', value.Affiliation.trim());
    if (value.WorkFrom) formData.append('WorkFrom', value.WorkFrom);
    if (value.WorkTo) formData.append('WorkTo', value.WorkTo);
    if (value.MaxConcurrent !== null && value.MaxConcurrent !== undefined) {
      formData.append('MaxConcurrent', String(value.MaxConcurrent));
    }
    formData.append('IsAvailable', String(value.IsAvailable));
    if (value.Notes.trim()) formData.append('Notes', value.Notes.trim());

    const file = this.imageFile();
    if (file) formData.append('Image', file, file.name);

    const request$ = selected
      ? this.service.updateDelegate(selected.DelegateId, formData)
      : this.service.createDelegate(formData);

    this.savingDelegate.set(true);
    request$
      .pipe(finalize(() => this.savingDelegate.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.handleSubmitError(res, this.t(selected ? 'MSG_SAVE_ERROR_EDIT' : 'MSG_SAVE_ERROR_ADD'));
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: this.t('TOAST_SUCCESS'),
            detail: this.t(selected ? 'MSG_SAVED_EDIT' : 'MSG_SAVED_ADD'),
          });
          this.showDialog.set(false);
          this.selectedDelegate.set(null);
          this.resetForm();
          this.loadDelegates();
        },
        error: err => this.handleSubmitError(err?.error, this.t(selected ? 'MSG_SAVE_ERROR_EDIT' : 'MSG_SAVE_ERROR_ADD')),
      });
  }

  // ── UI helpers ───────────────────────────────────────────────
  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  hasFieldError(field: keyof DelegateFormControls): boolean {
    const control = this.delegateForm.controls[field];
    return control.invalid && (control.touched || this.formSubmitted());
  }

  formatWork(item: DelegateListItem): string {
    const from = item.Work?.From ?? '';
    const to = item.Work?.To ?? '';
    if (!from && !to) return '—';
    return `${from} - ${to}`;
  }

  initials(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    return trimmed ? trimmed.charAt(0) : '؟';
  }

  mediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    const base = environment.uploadsBase.replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  // ── Internals ────────────────────────────────────────────────
  private patchFormFromDelegate(delegate: DelegateListItem): void {
    this.delegateForm.patchValue({
      DisplayName: delegate.FullName ?? '',
      IdNumber: delegate.IdNumber ?? '',
      Phone: delegate.Phone ?? '',
      Age: delegate.Age ?? null,
      Email: delegate.Email ?? '',
      Password: '',
      Nationality: delegate.Nationality ?? '',
      Affiliation: delegate.Affiliation ?? '',
      WorkFrom: delegate.Work?.From ?? '',
      WorkTo: delegate.Work?.To ?? '',
      MaxConcurrent: delegate.Work?.MaxConcurrent ?? 0,
      IsAvailable: delegate.Work?.IsAvailable ?? true,
      Notes: '',
    });
    this.imagePreview.set(delegate.ImageUrl ?? null);
    this.imageFile.set(null);
  }

  private resetForm(): void {
    this.formSubmitted.set(false);
    this.backendErrors.set([]);
    this.showPassword.set(false);
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.delegateForm.reset({
      DisplayName: '',
      IdNumber: '',
      Phone: '',
      Age: null,
      Email: '',
      Password: '',
      Nationality: '',
      Affiliation: '',
      WorkFrom: '08:00',
      WorkTo: '17:00',
      MaxConcurrent: 3,
      IsAvailable: true,
      Notes: '',
    });
  }

  private workRangeValidator = (group: AbstractControl): ValidationErrors | null => {
    const from = group.get('WorkFrom')?.value as string | undefined;
    const to = group.get('WorkTo')?.value as string | undefined;
    if (!from || !to) return null;
    return from < to ? null : { workRange: true };
  };

  private handleSubmitError(error: ApiResult<unknown> | undefined, fallback: string): void {
    const messages = this.resolveApiErrorMessages(error, fallback);
    this.backendErrors.set(messages);
    messages.forEach(detail => this.toast.add({ severity: 'error', summary: this.t('TOAST_ERROR'), detail, life: 6000 }));
  }

  private resolveApiErrorMessages(error: ApiResult<unknown> | undefined, fallback: string): string[] {
    if (error?.ValidationErrors?.length) {
      return error.ValidationErrors.map(item => item.ErrorMessage).filter(Boolean);
    }
    return [this.resolveApiErrorMessage(error, fallback)];
  }

  private resolveApiErrorMessage(error: ApiResult<unknown> | undefined, fallback: string): string {
    return error?.Error?.MessageKey
      || error?.Error?.Message
      || error?.Error?.message
      || error?.ValidationErrors?.[0]?.ErrorMessage
      || fallback;
  }
}
