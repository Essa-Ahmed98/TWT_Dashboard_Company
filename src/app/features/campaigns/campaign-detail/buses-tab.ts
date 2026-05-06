import { ChangeDetectionStrategy, Component, computed, inject, input, signal, afterNextRender } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { BusApiItem, BusForm, BUS_TYPES } from '../campaigns.model';
import { CampaignsService } from '../campaigns.service';

const EMPTY_FORM: BusForm = {
  number: '', driverName: '', driverPhone: '+966',
  capacity: '45', type: '', plateNumber: '', notes: '',
};

@Component({
  selector: 'app-campaign-buses-tab',
  imports: [TranslateModule, DecimalPipe],
  templateUrl: './buses-tab.html',
  styleUrl: './buses-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignBusesTab {
  private readonly service = inject(CampaignsService);
  private readonly toast   = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly campaignId = input.required<string>();

  readonly buses       = this.service.buses;
  readonly loading     = this.service.busesLoading;
  readonly totalPages  = this.service.busesTotalPages;
  readonly currentPage = this.service.busesCurrentPage;
  readonly totalCount  = this.service.busesTotalCount;

  readonly busTypes = BUS_TYPES;

  visiblePages = computed<(number | '...')[]>(() => {
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

  constructor() {
    afterNextRender(() => this.service.loadBuses(this.campaignId()));
  }

  private readonly saudiPhoneRegex = /^(?:\+966|00966|966|0)?5\d{8}$/;

  // ── Modal ─────────────────────────────────────────────────────
  showModal    = signal(false);
  form         = signal<BusForm>({ ...EMPTY_FORM });
  submitting   = signal(false);
  phoneTouched = signal(false);
  editingBus   = signal<BusApiItem | null>(null);

  modalTitleKey = computed(() =>
    this.editingBus() ? 'BUSES_TAB.MODAL_TITLE_EDIT' : 'BUSES_TAB.MODAL_TITLE_ADD'
  );

  modalSubtitleKey = computed(() =>
    this.editingBus() ? 'BUSES_TAB.MODAL_SUBTITLE_EDIT' : 'BUSES_TAB.MODAL_SUBTITLE_ADD'
  );

  readonly phoneInvalid = computed(() => {
    const phone = this.form().driverPhone.trim();
    if (!this.phoneTouched() || !phone) return false;
    return !this.saudiPhoneRegex.test(phone);
  });

  openModal(): void  {
    this.editingBus.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.phoneTouched.set(false);
    this.showModal.set(true);
  }

  openEditModal(bus: BusApiItem): void {
    this.editingBus.set(bus);
    this.form.set({
      number: bus.BusNumber,
      driverName: bus.DriverName,
      driverPhone: bus.DriverPhone,
      capacity: String(bus.SeatsCount ?? 45),
      type: bus.BusType,
      plateNumber: bus.PlateNumber,
      notes: bus.Notes ?? '',
    });
    this.phoneTouched.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.showModal.set(false);
  }

  patchForm(patch: Partial<BusForm>): void { this.form.update(f => ({ ...f, ...patch })); }

  submit(): void {
    const f = this.form();
    if (!f.number.trim() || !f.driverName.trim() || !f.type || !f.plateNumber.trim() || this.phoneInvalid() || !f.driverPhone.trim() || this.submitting()) return;

    this.submitting.set(true);
    const editingBus = this.editingBus();
    const request$ = editingBus
      ? this.service.updateBus(editingBus.Id, this.campaignId(), f, editingBus.CompanyId)
      : this.service.createBus(this.campaignId(), f);

    request$
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe(success => {
        if (!success) return;
        const wasEditing = !!editingBus;
        this.showModal.set(false);
        this.editingBus.set(null);
        if (wasEditing) {
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant('BUSES_TAB.EDIT_SUCCESS'),
          });
        }
      });
  }

  // ── Pagination ────────────────────────────────────────────────
  goToPage(page: number | '...'): void {
    if (page === '...' || page === this.currentPage()) return;
    this.service.loadBuses(this.campaignId(), page);
  }
}
