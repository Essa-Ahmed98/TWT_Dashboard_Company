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
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/services/auth';
import { ApiResult } from '../../core/models/api.models';
import { DevicesService } from './devices.service';
import { DeviceItem, DeviceForm, PilgrimOption } from './devices.model';

const EMPTY_FORM: DeviceForm = { imeiNumber: '', simNumber: '', notes: '' };

@Component({
  selector:    'app-devices',
  imports:     [FormsModule, ProgressSpinnerModule, TooltipModule, DecimalPipe],
  templateUrl: './devices.html',
  styleUrl:    './devices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Devices implements OnInit {
  private readonly service    = inject(DevicesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast      = inject(MessageService);
  private readonly auth       = inject(AuthService);

  // ── State ────────────────────────────────────────────────────────
  devices     = signal<DeviceItem[]>([]);
  totalCount  = signal(0);
  totalPages  = signal(0);
  currentPage = signal(1);
  pageSize    = signal(10);
  loading     = signal(false);

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

  searchQuery = signal('');
  showModal   = signal(false);
  saving      = signal(false);
  editingId   = signal<string | null>(null);
  formData    = signal<DeviceForm>({ ...EMPTY_FORM });

  showImportModal      = signal(false);
  downloadingTemplate  = signal(false);
  importSelectedFile   = signal<File | null>(null);
  importSelectedName   = signal('');
  uploadingImportFile  = signal(false);

  // ── Link modal state ─────────────────────────────────────────────
  showLinkModal      = signal(false);
  linkingDevice      = signal<DeviceItem | null>(null);
  pilgrims           = signal<PilgrimOption[]>([]);
  loadingPilgrims    = signal(false);
  selectedPilgrimId  = signal('');
  selectedPilgrimName = signal('');
  showPilgrimDrop    = signal(false);
  savingLink         = signal(false);

  private readonly search$ = new Subject<string>();

  // ── Lifecycle ────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load('');

    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(q => this.load(q));
  }

  // ── Data ─────────────────────────────────────────────────────────
  private load(search: string, page = this.currentPage()): void {
    this.loading.set(true);
    this.service
      .getDevices({ pageNumber: page, pageSize: this.pageSize(), search })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) {
            this.devices.set(res.Data.Items);
            this.totalCount.set(res.Data.TotalCount);
            this.totalPages.set(res.Data.TotalPages);
            this.currentPage.set(res.Data.CurrentPage);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
    this.search$.next(value);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.load(this.searchQuery(), page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load(this.searchQuery(), 1);
  }

  // ── Add/Edit modal ───────────────────────────────────────────────
  openModal(): void {
    this.editingId.set(null);
    this.formData.set({ ...EMPTY_FORM });
    this.showModal.set(true);
  }

  openImportModal(): void {
    this.importSelectedFile.set(null);
    this.importSelectedName.set('');
    this.downloadingTemplate.set(false);
    this.uploadingImportFile.set(false);
    this.showImportModal.set(true);
  }

  openEditModal(device: DeviceItem): void {
    this.editingId.set(device.Id);
    this.formData.set({
      imeiNumber: device.ImeiNumber ?? '',
      simNumber:  device.SimNumber  ?? '',
      notes:      device.Notes      ?? '',
    });
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  closeImportModal(): void {
    if (this.uploadingImportFile()) return;
    this.showImportModal.set(false);
  }

  patchForm(patch: Partial<DeviceForm>): void {
    this.formData.update(f => ({ ...f, ...patch }));
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.importSelectedFile.set(file ?? null);
    this.importSelectedName.set(file?.name ?? '');
  }

  downloadImportTemplate(): void {
    if (this.downloadingTemplate()) return;

    this.downloadingTemplate.set(true);
    this.service.downloadTemplate('ar')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.downloadingTemplate.set(false);
          const blob = response.body;
          if (!blob) {
            this.showImportError();
            return;
          }

          const fileName = this.extractFileName(response.headers.get('content-disposition'))
            || 'devices-template.xlsx';

          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.click();
          anchor.remove();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.downloadingTemplate.set(false);
          this.showImportError();
        },
      });
  }

  handleImportUpload(fileInput: HTMLInputElement): void {
    if (this.uploadingImportFile()) return;

    const selectedFile = this.importSelectedFile();
    if (!selectedFile) {
      fileInput.click();
      return;
    }

    this.uploadingImportFile.set(true);
    this.service.uploadDevicesFile(selectedFile, 'ar')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.uploadingImportFile.set(false);
          const isSuccess = (response as ApiResult<unknown>)?.IsSuccess
            ?? (response as { issuccess?: boolean; IsSuccess?: boolean })?.issuccess
            ?? false;

          if (isSuccess) {
            this.showImportModal.set(false);
            this.importSelectedFile.set(null);
            this.importSelectedName.set('');
            fileInput.value = '';
            this.load(this.searchQuery());
            return;
          }

          this.showImportError();
        },
        error: () => {
          this.uploadingImportFile.set(false);
          this.showImportError();
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

  private showImportError(): void {
    this.toast.add({
      severity: 'error',
      summary: 'خطأ',
      detail: 'فيه مشكلة ولم نتمكن من تنفيذ العملية',
    });
  }

  submitForm(): void {
    const f  = this.formData();
    const id = this.editingId();
    if (!f.imeiNumber.trim() || this.saving()) return;

    this.saving.set(true);
    const req$ = id
      ? this.service.updateDevice({
          Id:         id,
          ImeiNumber: f.imeiNumber.trim(),
          SimNumber:  f.simNumber.trim(),
          Notes:      f.notes.trim(),
        })
      : this.service.addDevice({
          ImeiNumber: f.imeiNumber.trim(),
          SimNumber:  f.simNumber.trim(),
          Notes:      f.notes.trim(),
        });

    req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.saving.set(false);
        if (res.IsSuccess) {
          this.closeModal();
          this.load(this.searchQuery());
        } else {
          this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'حدث خطأ، حاول مرة أخرى' });
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'حدث خطأ، حاول مرة أخرى' });
      },
    });
  }

  // ── Link modal ───────────────────────────────────────────────────
  openLinkModal(device: DeviceItem): void {
    this.linkingDevice.set(device);
    this.selectedPilgrimId.set('');
    this.selectedPilgrimName.set('');
    this.showPilgrimDrop.set(false);
    this.showLinkModal.set(true);

    const companyId = this.auth.currentUser()?.companyId ?? '';
    this.loadingPilgrims.set(true);
    this.service
      .getAllPilgrims(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.pilgrims.set(res.IsSuccess ? res.Data : []);
          this.loadingPilgrims.set(false);
        },
        error: () => {
          this.pilgrims.set([]);
          this.loadingPilgrims.set(false);
        },
      });
  }

  closeLinkModal(): void {
    this.showLinkModal.set(false);
    this.showPilgrimDrop.set(false);
  }

  togglePilgrimDrop(): void { this.showPilgrimDrop.update(v => !v); }

  selectPilgrim(p: PilgrimOption): void {
    this.selectedPilgrimId.set(p.Id);
    this.selectedPilgrimName.set(p.Name);
    this.showPilgrimDrop.set(false);
  }

  clearPilgrim(): void {
    this.selectedPilgrimId.set('');
    this.selectedPilgrimName.set('');
  }

  confirmLink(): void {
    const device = this.linkingDevice();
    const userId = this.selectedPilgrimId();
    if (!device || !userId || this.savingLink()) return;

    this.savingLink.set(true);
    this.service
      .updateDeviceConnection({ Id: device.Id, UserId: userId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.savingLink.set(false);
          if (res.IsSuccess) {
            this.closeLinkModal();
            this.load(this.searchQuery());
          } else {
            this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذّر ربط الجهاز' });
          }
        },
        error: () => {
          this.savingLink.set(false);
          this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذّر ربط الجهاز' });
        },
      });
  }

  unlinkDevice(device: DeviceItem): void {
    this.service
      .updateDeviceConnection({ Id: device.Id, UserId: null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this.load(this.searchQuery());
          else this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذّر فك الربط' });
        },
        error: () => this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذّر فك الربط' }),
      });
  }

  // ── Delete ───────────────────────────────────────────────────────
  deleteDevice(id: string): void {
    this.service
      .deleteDevice(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this.load(this.searchQuery());
          else this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذّر حذف الجهاز' });
        },
        error: () => this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'تعذّر حذف الجهاز' }),
      });
  }
}
