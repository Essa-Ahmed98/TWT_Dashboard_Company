import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Tooltip } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import {
  PERMISSION_GROUPS,
  PICKER_PERMISSIONS,
  PermissionGroup,
  permissionHintKey,
  permissionLabelKey,
} from '../../core/auth/permissions';
import { TranslationService } from '../../core/services/translation.service';
import { apiErrorMessages } from '../../core/utils/api-error';
import { STAFF_RULES, STAFF_STATUS, StaffMember } from './staff.model';
import { StaffService } from './staff.service';

interface StaffFormControls {
  DisplayName: FormControl<string>;
  Email: FormControl<string>;
  Phone: FormControl<string>;
  Password: FormControl<string>;
  Permissions: FormControl<string[]>;
}

/** How many permission chips a row shows before "+N" */
const VISIBLE_CHIPS = 3;

/**
 * "Staff and permissions" (company manager only): add staff accounts, choose the sections each one may use,
 * edit them, and suspend / reactivate them.
 */
@Component({
  selector: 'app-staff',
  imports: [ReactiveFormsModule, TranslateModule, ProgressSpinnerModule, Tooltip],
  templateUrl: './staff.html',
  styleUrl: './staff.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Staff implements OnInit {
  private readonly service = inject(StaffService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly translation = inject(TranslationService);

  readonly groups: PermissionGroup[] = PERMISSION_GROUPS;
  readonly rules = STAFF_RULES;
  readonly labelKey = permissionLabelKey;
  readonly hintKey = permissionHintKey;

  readonly staff = signal<StaffMember[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly search = signal('');

  readonly showForm = signal(false);
  readonly editing = signal<StaffMember | null>(null);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<string[]>([]);
  readonly showPassword = signal(false);
  /** Permissions the user has that this page does not offer (kept as they are when saving) */
  private keptPermissions: string[] = [];

  readonly statusTarget = signal<StaffMember | null>(null);
  readonly statusSaving = signal(false);

  readonly form = new FormGroup<StaffFormControls>({
    DisplayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(STAFF_RULES.nameMaxLength)],
    }),
    Email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(STAFF_RULES.email)],
    }),
    Phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(STAFF_RULES.saudiPhone)] }),
    Password: new FormControl('', { nonNullable: true }),
    Permissions: new FormControl<string[]>([], { nonNullable: true, validators: [Validators.required] }),
  });

  /** the picker value as a signal, so the checkboxes and counters follow it */
  readonly selected = signal<string[]>([]);

  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = [...this.staff()].sort((a, b) => (b.CreatedAt ?? '').localeCompare(a.CreatedAt ?? ''));
    if (!query) return list;
    return list.filter(member =>
      [member.DisplayName, member.Email, member.Phone].some(value => (value ?? '').toLowerCase().includes(query)),
    );
  });

  readonly totalCount = computed(() => this.staff().length);
  readonly activeCount = computed(() => this.staff().filter(member => this.isActive(member)).length);
  readonly stoppedCount = computed(() => this.totalCount() - this.activeCount());
  readonly isEdit = computed(() => !!this.editing());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.service
      .getStaff()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => this.staff.set(res.IsSuccess ? res.Data ?? [] : []),
        // the error interceptor already shows the server message
        error: () => {
          this.staff.set([]);
          this.loadFailed.set(true);
        },
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  // ── add / edit ─────────────────────────────────────────────────

  openAdd(): void {
    this.editing.set(null);
    this.resetForm([]);
    this.form.controls.Password.setValidators([Validators.required, Validators.minLength(STAFF_RULES.passwordMinLength)]);
    this.form.controls.Password.updateValueAndValidity();
    this.showForm.set(true);
  }

  openEdit(member: StaffMember): void {
    this.editing.set(member);
    const permissions = member.Permissions ?? [];
    this.keptPermissions = permissions.filter(permission => !PICKER_PERMISSIONS.includes(permission));
    this.resetForm(permissions.filter(permission => PICKER_PERMISSIONS.includes(permission)));
    this.form.patchValue({
      DisplayName: member.DisplayName ?? '',
      Email: member.Email ?? '',
      Phone: member.Phone ?? '',
    });
    // the password is not changed from this page
    this.form.controls.Password.clearValidators();
    this.form.controls.Password.updateValueAndValidity();
    this.showForm.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
    this.editing.set(null);
  }

  submit(): void {
    this.submitted.set(true);
    this.serverErrors.set([]);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const phone = value.Phone.trim() || null;
    const member = this.editing();
    const permissions = [...value.Permissions, ...this.keptPermissions];
    const request$ = member
      ? this.service.updateStaff({
          UserId: member.Id,
          DisplayName: value.DisplayName.trim(),
          Email: value.Email.trim(),
          Phone: phone,
          Permissions: permissions,
        })
      : this.service.createStaff({
          DisplayName: value.DisplayName.trim(),
          Email: value.Email.trim(),
          Phone: phone,
          Password: value.Password,
          Permissions: permissions,
        });

    this.saving.set(true);
    request$
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.serverErrors.set(apiErrorMessages(res, this.translate.instant('STAFF.SAVE_ERROR')));
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant(member ? 'STAFF.UPDATED' : 'STAFF.CREATED'),
          });
          this.showForm.set(false);
          this.editing.set(null);
          this.load();
        },
        // the interceptor shows a toast too; the dialog keeps the server's messages next to the form
        error: err => this.serverErrors.set(apiErrorMessages(err, this.translate.instant('STAFF.SAVE_ERROR'))),
      });
  }

  // ── permission picker ──────────────────────────────────────────

  isSelected(permission: string): boolean {
    return this.selected().includes(permission);
  }

  toggle(permission: string, checked: boolean): void {
    const current = this.selected();
    this.setPermissions(checked ? [...current, permission] : current.filter(item => item !== permission));
  }

  groupState(group: PermissionGroup): 'all' | 'some' | 'none' {
    const count = group.permissions.filter(permission => this.isSelected(permission)).length;
    return count === 0 ? 'none' : count === group.permissions.length ? 'all' : 'some';
  }

  toggleGroup(group: PermissionGroup, checked: boolean): void {
    const others = this.selected().filter(permission => !group.permissions.includes(permission));
    this.setPermissions(checked ? [...others, ...group.permissions] : others);
  }

  allSelected(): boolean {
    return PICKER_PERMISSIONS.every(permission => this.isSelected(permission));
  }

  toggleAll(checked: boolean): void {
    this.setPermissions(checked ? [...PICKER_PERMISSIONS] : []);
  }

  private setPermissions(permissions: string[]): void {
    // keep the picker order, no duplicates
    const next = PICKER_PERMISSIONS.filter(permission => permissions.includes(permission));
    this.selected.set(next);
    this.form.controls.Permissions.setValue(next);
    this.form.controls.Permissions.markAsTouched();
  }

  // ── suspend / reactivate ───────────────────────────────────────

  askStatus(member: StaffMember): void {
    this.statusTarget.set(member);
  }

  cancelStatus(): void {
    if (this.statusSaving()) return;
    this.statusTarget.set(null);
  }

  confirmStatus(): void {
    const member = this.statusTarget();
    if (!member || this.statusSaving()) return;

    const activate = !this.isActive(member);
    const status = activate ? STAFF_STATUS.Active : STAFF_STATUS.Suspended;
    this.statusSaving.set(true);
    this.service
      .setStatus(member.Id, status)
      .pipe(finalize(() => this.statusSaving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.toast.add({
              severity: 'error',
              summary: this.translate.instant('COMMON.ERROR'),
              detail: apiErrorMessages(res, this.translate.instant('STAFF.STATUS_ERROR')).join('، '),
            });
            return;
          }
          this.staff.update(list => list.map(item => (item.Id === member.Id ? { ...item, Status: status } : item)));
          this.statusTarget.set(null);
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant(activate ? 'STAFF.ACTIVATED' : 'STAFF.SUSPENDED'),
          });
        },
        // the error interceptor already shows the server message
        error: () => this.statusTarget.set(null),
      });
  }

  // ── view helpers ───────────────────────────────────────────────

  isActive(member: StaffMember): boolean {
    return member.Status === STAFF_STATUS.Active;
  }

  statusKey(member: StaffMember): string {
    switch (member.Status) {
      case STAFF_STATUS.Active: return 'STAFF.STATUS.ACTIVE';
      case STAFF_STATUS.Pending: return 'STAFF.STATUS.PENDING';
      default: return 'STAFF.STATUS.SUSPENDED';
    }
  }

  chips(member: StaffMember): string[] {
    return (member.Permissions ?? []).slice(0, VISIBLE_CHIPS);
  }

  moreCount(member: StaffMember): number {
    return Math.max((member.Permissions?.length ?? 0) - VISIBLE_CHIPS, 0);
  }

  moreLabel(member: StaffMember): string {
    return (member.Permissions ?? [])
      .slice(VISIBLE_CHIPS)
      .map(permission => this.translate.instant(permissionLabelKey(permission)))
      .join('، ');
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const lang = this.translation.currentLang();
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  invalid(field: keyof StaffFormControls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  private resetForm(permissions: string[]): void {
    this.submitted.set(false);
    this.serverErrors.set([]);
    this.showPassword.set(false);
    if (!this.editing()) this.keptPermissions = [];
    this.form.reset({ DisplayName: '', Email: '', Phone: '', Password: '', Permissions: [] });
    this.setPermissions(permissions);
    this.form.controls.Permissions.markAsUntouched();
  }
}
