import { ChangeDetectionStrategy, Component, computed, inject, input, signal, afterNextRender } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { GroupApiItem, GroupForm } from '../campaigns.model';
import { CampaignsService } from '../campaigns.service';

const EMPTY_FORM: GroupForm = { name: '', notes: '' };

@Component({
  selector: 'app-campaign-groups-tab',
  imports: [DecimalPipe],
  templateUrl: './groups-tab.html',
  styleUrl: './groups-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignGroupsTab {
  private readonly service = inject(CampaignsService);
  private readonly router  = inject(Router);
  private readonly toast   = inject(MessageService);

  readonly campaignId = input.required<string>();

  readonly groups      = this.service.groups;
  readonly loading     = this.service.groupsLoading;
  readonly totalPages  = this.service.groupsTotalPages;
  readonly currentPage = this.service.groupsCurrentPage;
  readonly totalCount  = this.service.groupsTotalCount;

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
    afterNextRender(() => this.service.loadGroups(this.campaignId()));
  }

  // ── Modal ─────────────────────────────────────────────────────
  showModal  = signal(false);
  form       = signal<GroupForm>({ ...EMPTY_FORM });
  submitting = signal(false);
  editingGroup = signal<GroupApiItem | null>(null);

  modalTitle = computed(() =>
    this.editingGroup() ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'
  );

  modalSubtitle = computed(() =>
    this.editingGroup() ? 'عدّل بيانات المجموعة داخل المركز' : 'أدخل بيانات المجموعة لإنشائها داخل المركز'
  );

  openModal(): void  {
    this.editingGroup.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.showModal.set(true);
  }

  openEditModal(group: GroupApiItem, event: Event): void {
    event.stopPropagation();
    this.editingGroup.set(group);
    this.form.set({ name: group.Name, notes: group.Notes ?? '' });
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.showModal.set(false);
  }

  patchForm(patch: Partial<GroupForm>): void { this.form.update(f => ({ ...f, ...patch })); }

  submit(): void {
    const f = this.form();
    if (!f.name.trim() || this.submitting()) return;

    this.submitting.set(true);
    const editingGroup = this.editingGroup();
    const request$ = editingGroup
      ? this.service.updateGroup(editingGroup.Id, f.name.trim(), f.notes.trim(), this.campaignId(), editingGroup.CompanyId)
      : this.service.createGroup(f.name.trim(), f.notes.trim(), this.campaignId());

    request$
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe(success => {
        if (!success) return;
        const wasEditing = !!editingGroup;
        this.showModal.set(false);
        this.editingGroup.set(null);
        if (wasEditing) {
          this.toast.add({ severity: 'success', summary: 'نجاح', detail: 'تم تعديل المجموعة بنجاح' });
        }
      });
  }

  // ── Accordion ─────────────────────────────────────────────────
  expandedGroups = signal<Set<string>>(new Set());

  toggleGroup(id: string): void {
    this.expandedGroups.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  isExpanded(id: string): boolean { return this.expandedGroups().has(id); }

  // ── Pagination ────────────────────────────────────────────────
  goToPage(page: number | '...'): void {
    if (page === '...' || page === this.currentPage()) return;
    this.service.loadGroups(this.campaignId(), page);
  }

  openPilgrimDetail(id: string): void {
    this.router.navigate(['/pilgrims', id]);
  }

  viewGroupPilgrims(): void {
    this.router.navigate(['/pilgrims'], { queryParams: { campaign: this.campaignId() } });
  }
}
