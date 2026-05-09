import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DatePicker } from 'primeng/datepicker';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ApiResult } from '../../core/models/api.models';
import { SupervisorItem } from '../supervisors/supervisors.model';
import { SupervisorsService } from '../supervisors/supervisors.service';
import {
  AssignSupervisorTaskRequest,
  SupervisorTaskItem,
  TaskCategory,
  TaskForm,
  TaskSupervisorStatus,
} from './tasks.model';
import { TasksService } from './tasks.service';

interface TaskOption<T> {
  value: T;
  labelKey: string;
}

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  supervisorId: '',
  category: '',
  dueDate: '',
  dueTime: '',
};

@Component({
  selector: 'app-tasks',
  imports: [DatePipe, DecimalPipe, FormsModule, DatePicker, ProgressSpinnerModule, TranslateModule],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tasks implements OnInit {
  private readonly service = inject(TasksService);
  private readonly supervisorsService = inject(SupervisorsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly TaskSupervisorStatus = TaskSupervisorStatus;
  readonly minDueDate = new Date();

  pageSize = signal(10);
  tasks = signal<SupervisorTaskItem[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  totalCount = signal(0);
  pendingCount = signal(0);
  completedCount = signal(0);
  apiDelayedCount = signal<number | null>(null);
  totalPages = signal(0);
  currentPage = signal(1);
  hasNext = signal(false);
  hasPrevious = signal(false);

  statusFilter = signal<TaskSupervisorStatus | ''>('');
  filterSupervisorId = signal('');
  filterSupervisorName = signal('');

  showModal = signal(false);
  submitting = signal(false);
  submitError = signal<string | null>(null);
  formData = signal<TaskForm>({ ...EMPTY_FORM });
  touched = signal(false);

  showSupervisorDrop = signal(false);
  supervisorSearch = signal('');
  supervisorLoading = signal(false);
  supervisorList = signal<SupervisorItem[]>([]);
  selectedSupervisorName = signal('');
  private readonly supervisorSearch$ = new Subject<string>();

  showFilterSupervisorDrop = signal(false);
  filterSupervisorSearch = signal('');
  filterSupervisorLoading = signal(false);
  filterSupervisorList = signal<SupervisorItem[]>([]);
  private readonly filterSupervisorSearch$ = new Subject<string>();

  showStatusDrop = signal(false);
  showCategoryDrop = signal(false);

  readonly categoryOptions: TaskOption<TaskCategory>[] = [
    { value: TaskCategory.General, labelKey: 'TASKS.CATEGORY.GENERAL' },
    { value: TaskCategory.HealthCheckup, labelKey: 'TASKS.CATEGORY.HEALTH_CHECKUP' },
    { value: TaskCategory.Health, labelKey: 'TASKS.CATEGORY.HEALTH' },
    { value: TaskCategory.Meals, labelKey: 'TASKS.CATEGORY.MEALS' },
    { value: TaskCategory.Transportation, labelKey: 'TASKS.CATEGORY.TRANSPORTATION' },
    { value: TaskCategory.Logistics, labelKey: 'TASKS.CATEGORY.LOGISTICS' },
    { value: TaskCategory.Reports, labelKey: 'TASKS.CATEGORY.REPORTS' },
  ];

  readonly statusOptions: TaskOption<TaskSupervisorStatus>[] = [
    { value: TaskSupervisorStatus.Pending, labelKey: 'TASKS.STATUS.PENDING' },
    { value: TaskSupervisorStatus.Completed, labelKey: 'TASKS.STATUS.COMPLETED' },
  ];

  readonly filteredTasks = computed(() => this.tasks());

  readonly delayedCount = computed(() => {
    const delayedFromApi = this.apiDelayedCount();
    if (delayedFromApi !== null) return delayedFromApi;
    return this.tasks().filter(task => this.isDelayed(task)).length;
  });

  readonly visiblePages = computed<(number | '...')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page++) {
      pages.push(page);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  readonly isFormValid = computed(() => {
    return this.hasRequiredFormFields() && !this.isDueDateInPast() && !this.submitting();
  });

  readonly hasRequiredFormFields = computed(() => {
    const f = this.formData();
    return !!(f.title.trim() && f.supervisorId && f.category !== '' && f.dueDate);
  });

  ngOnInit(): void {
    this.load();

    this.supervisorSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.loadSupervisors(value));

    this.filterSupervisorSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.loadFilterSupervisors(value));
  }

  load(page = this.currentPage()): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.service.getAssigned({
      pageNumber: page,
      pageSize: this.pageSize(),
      statusFilter: this.statusFilter() === '' ? undefined : this.statusFilter() as TaskSupervisorStatus,
      supervisorId: this.filterSupervisorId() || undefined,
    })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.loadError.set(this.resolveApiErrorMessage(res, 'TASKS.ERRORS.LOAD'));
            return;
          }

          const data = res.Data;
          const pageData = data.Tasks;
          this.tasks.set(pageData.Items ?? []);
          this.totalCount.set(data.TotalCount ?? pageData.TotalCount ?? 0);
          this.pendingCount.set(data.PendingCount ?? 0);
          this.completedCount.set(data.CompletedCount ?? 0);
          this.apiDelayedCount.set(data.DelayedCount ?? null);
          this.totalPages.set(pageData.TotalPages ?? 0);
          this.currentPage.set(pageData.CurrentPage || page);
          this.hasNext.set(!!pageData.HasNext);
          this.hasPrevious.set(!!pageData.HasPrevious);
        },
        error: err => this.loadError.set(this.resolveApiErrorMessage(err?.error, 'TASKS.ERRORS.LOAD')),
      });
  }

  toggleStatusDrop(): void {
    if (this.showStatusDrop()) {
      this.showStatusDrop.set(false);
      return;
    }

    this.closeAllDrops();
    this.showStatusDrop.set(true);
  }

  selectStatusFilter(value: TaskSupervisorStatus | ''): void {
    this.statusFilter.set(value);
    this.showStatusDrop.set(false);
    this.currentPage.set(1);
    this.load(1);
  }

  statusFilterLabelKey(): string {
    const status = this.statusFilter();
    return status === '' ? 'TASKS.FILTERS.ALL_STATUSES' : this.statusLabelKey(status);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load(1);
  }

  toggleFilterSupervisorDrop(): void {
    if (this.showFilterSupervisorDrop()) {
      this.showFilterSupervisorDrop.set(false);
      return;
    }

    this.closeAllDrops();
    this.showFilterSupervisorDrop.set(true);
    if (this.filterSupervisorList().length === 0 && !this.filterSupervisorLoading()) {
      this.loadFilterSupervisors(this.filterSupervisorSearch());
    }
  }

  onFilterSupervisorSearch(value: string): void {
    this.filterSupervisorSearch.set(value);
    this.filterSupervisorSearch$.next(value);
  }

  selectFilterSupervisor(supervisor: SupervisorItem): void {
    this.filterSupervisorId.set(supervisor.Id);
    this.filterSupervisorName.set(supervisor.DisplayName || supervisor.UserId);
    this.showFilterSupervisorDrop.set(false);
    this.currentPage.set(1);
    this.load(1);
  }

  clearFilterSupervisor(): void {
    this.filterSupervisorId.set('');
    this.filterSupervisorName.set('');
    this.filterSupervisorSearch.set('');
    this.showFilterSupervisorDrop.set(false);
    this.currentPage.set(1);
    this.load(1);
  }

  goToPage(page: number | '...'): void {
    if (page === '...' || page < 1 || page > this.totalPages() || page === this.currentPage() || this.loading()) return;
    this.load(page);
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  openModal(): void {
    this.formData.set({ ...EMPTY_FORM });
    this.touched.set(false);
    this.submitError.set(null);
    this.selectedSupervisorName.set('');
    this.supervisorSearch.set('');
    this.supervisorList.set([]);
    this.showFilterSupervisorDrop.set(false);
    this.showSupervisorDrop.set(false);
    this.showCategoryDrop.set(false);
    this.showFilterSupervisorDrop.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.showModal.set(false);
    this.closeAllDrops();
  }

  patchForm(patch: Partial<TaskForm>): void {
    this.formData.update(form => ({ ...form, ...patch }));
  }

  toggleSupervisorDrop(): void {
    if (this.showSupervisorDrop()) {
      this.showSupervisorDrop.set(false);
      return;
    }

    this.showCategoryDrop.set(false);
    this.showSupervisorDrop.set(true);
    if (this.supervisorList().length === 0 && !this.supervisorLoading()) {
      this.loadSupervisors(this.supervisorSearch());
    }
  }

  onSupervisorSearch(value: string): void {
    this.supervisorSearch.set(value);
    this.supervisorSearch$.next(value);
  }

  selectSupervisor(supervisor: SupervisorItem): void {
    this.patchForm({ supervisorId: supervisor.Id });
    this.selectedSupervisorName.set(supervisor.DisplayName || supervisor.UserId);
    this.showSupervisorDrop.set(false);
  }

  clearSupervisor(): void {
    this.patchForm({ supervisorId: '' });
    this.selectedSupervisorName.set('');
  }

  private loadSupervisors(search: string): void {
    this.supervisorLoading.set(true);
    this.supervisorsService.getSupervisors({
      pageNumber: 1,
      pageSize: 10,
      search: search.trim() || undefined,
    })
      .pipe(finalize(() => this.supervisorLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this.supervisorList.set(res.Data.Supervisors.Items ?? []);
        },
        error: () => this.supervisorList.set([]),
      });
  }

  private loadFilterSupervisors(search: string): void {
    this.filterSupervisorLoading.set(true);
    this.supervisorsService.getSupervisors({
      pageNumber: 1,
      pageSize: 10,
      search: search.trim() || undefined,
    })
      .pipe(finalize(() => this.filterSupervisorLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) this.filterSupervisorList.set(res.Data.Supervisors.Items ?? []);
        },
        error: () => this.filterSupervisorList.set([]),
      });
  }

  toggleCategoryDrop(): void {
    this.showSupervisorDrop.set(false);
    this.showFilterSupervisorDrop.set(false);
    this.showStatusDrop.set(false);
    this.showCategoryDrop.update(open => !open);
  }

  selectCategory(category: TaskCategory): void {
    this.patchForm({ category });
    this.showCategoryDrop.set(false);
  }

  closeAllDrops(): void {
    this.showSupervisorDrop.set(false);
    this.showFilterSupervisorDrop.set(false);
    this.showStatusDrop.set(false);
    this.showCategoryDrop.set(false);
  }

  submit(): void {
    this.touched.set(true);
    if (!this.isFormValid()) return;

    const f = this.formData();
    const payload: AssignSupervisorTaskRequest = {
      SupervisorId: f.supervisorId,
      Title: f.title.trim(),
      Description: f.description.trim(),
      Category: f.category as TaskCategory,
      DueDate: this.buildDueDate(f.dueDate, f.dueTime),
    };

    this.submitting.set(true);
    this.submitError.set(null);
    this.service.assign(payload)
      .pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.submitError.set(this.resolveApiErrorMessage(res, 'TASKS.ERRORS.ASSIGN'));
            return;
          }

          this.showModal.set(false);
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant('TASKS.ASSIGN_SUCCESS'),
          });
          this.load(1);
        },
        error: err => this.submitError.set(this.resolveApiErrorMessage(err?.error, 'TASKS.ERRORS.ASSIGN')),
      });
  }

  categoryLabelKey(category: TaskCategory | number | '' | null | undefined): string {
    if (category === '') return 'TASKS.CATEGORY.UNKNOWN';
    return this.categoryOptions.find(option => option.value === category)?.labelKey ?? 'TASKS.CATEGORY.UNKNOWN';
  }

  statusLabelKey(status: TaskSupervisorStatus | number | null | undefined): string {
    return status === TaskSupervisorStatus.Completed ? 'TASKS.STATUS.COMPLETED' : 'TASKS.STATUS.PENDING';
  }

  statusClass(task: SupervisorTaskItem): string {
    if (this.isDelayed(task)) return 'status-badge--delayed';
    return task.Status === TaskSupervisorStatus.Completed ? 'status-badge--completed' : 'status-badge--pending';
  }

  statusDisplayKey(task: SupervisorTaskItem): string {
    if (this.isDelayed(task)) return 'TASKS.STATUS.DELAYED';
    return this.statusLabelKey(task.Status);
  }

  categoryTone(category: TaskCategory | number | null | undefined): string {
    switch (category) {
      case TaskCategory.HealthCheckup:
      case TaskCategory.Health:
        return 'health';
      case TaskCategory.Meals:
        return 'meals';
      case TaskCategory.Transportation:
        return 'transport';
      case TaskCategory.Logistics:
        return 'logistics';
      case TaskCategory.Reports:
        return 'reports';
      default:
        return 'general';
    }
  }

  isDelayed(task: SupervisorTaskItem): boolean {
    if (task.Status === TaskSupervisorStatus.Completed) return false;
    const due = new Date(task.DueDate);
    return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
  }

  private buildDueDate(date: string | Date, time: string): string {
    const value = this.toDueDate(date, time);
    return value ? value.toISOString() : String(date);
  }

  isDueDateInPast(): boolean {
    const f = this.formData();
    if (!f.dueDate) return false;
    const due = f.dueDate instanceof Date ? new Date(f.dueDate) : new Date(f.dueDate);
    if (Number.isNaN(due.getTime())) return true;

    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  private toDueDate(date: string | Date, time: string): Date | null {
    const dateValue = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateValue.getTime())) return null;

    const [hours, minutes] = (time || '00:00').split(':').map(part => Number(part));
    const due = new Date(dateValue);
    due.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    return due;
  }

  private resolveApiErrorMessage(error: ApiResult<unknown> | undefined, fallbackKey: string): string {
    return error?.Error?.MessageKey ||
      error?.Error?.message ||
      error?.ValidationErrors?.[0]?.ErrorMessage ||
      this.translate.instant(fallbackKey);
  }
}
