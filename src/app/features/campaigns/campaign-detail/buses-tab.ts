import { ChangeDetectionStrategy, Component, computed, inject, input, signal, afterNextRender } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BusForm, BUS_TYPES } from '../campaigns.model';
import { CampaignsService } from '../campaigns.service';

const EMPTY_FORM: BusForm = {
  number: '', driverName: '', driverPhone: '+966',
  capacity: '45', type: '', plateNumber: '', notes: '',
};

@Component({
  selector: 'app-campaign-buses-tab',
  imports: [DecimalPipe],
  templateUrl: './buses-tab.html',
  styleUrl: './buses-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignBusesTab {
  private readonly service = inject(CampaignsService);

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

  // ── Modal ─────────────────────────────────────────────────────
  showModal  = signal(false);
  form       = signal<BusForm>({ ...EMPTY_FORM });
  submitting = signal(false);

  openModal(): void  { this.form.set({ ...EMPTY_FORM }); this.showModal.set(true); }
  closeModal(): void { this.showModal.set(false); }
  patchForm(patch: Partial<BusForm>): void { this.form.update(f => ({ ...f, ...patch })); }

  submit(): void {
    const f = this.form();
    if (!f.number.trim() || !f.driverName.trim() || !f.type || !f.plateNumber.trim() || this.submitting()) return;
    this.submitting.set(true);
    this.service.createBus(this.campaignId(), f);
    this.submitting.set(false);
    this.closeModal();
  }

  // ── Pagination ────────────────────────────────────────────────
  goToPage(page: number | '...'): void {
    if (page === '...' || page === this.currentPage()) return;
    this.service.loadBuses(this.campaignId(), page);
  }
}
