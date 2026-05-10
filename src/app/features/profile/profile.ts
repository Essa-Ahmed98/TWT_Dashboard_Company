import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/services/auth';
import { ValidationError } from '../../core/models/api.models';
import { ProfileService } from './profile.service';
import { UserProfile } from './profile.model';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageLoading = signal(false);
  readonly profileSaving = signal(false);
  readonly imageUploading = signal(false);
  readonly passwordSaving = signal(false);
  readonly showOldPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly profile = signal<UserProfile | null>(null);
  readonly avatarPreviewUrl = signal('');
  readonly profileValidationErrors = signal<Record<string, string>>({});

  private objectAvatarUrl: string | null = null;

  readonly profileForm = this.fb.nonNullable.group({
    DisplayName: ['', Validators.required],
    Email: ['', [Validators.required, Validators.email]],
    Phone: ['', Validators.required],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    OldPassword: ['', Validators.required],
    NewPassword: ['', Validators.required],
    ConfirmPassword: ['', Validators.required],
  });

  readonly currentUserId = computed(() => this.auth.currentUser()?.userId ?? '');
  readonly roleLabelKey = computed(() => this.roleKey(this.profile()?.Role ?? this.auth.currentUser()?.role));

  ngOnInit(): void {
    this.loadProfile();
    this.destroyRef.onDestroy(() => this.revokeObjectAvatarUrl());
  }

  loadProfile(showErrorToast = true, showPageLoading = true): void {
    if (showPageLoading) this.pageLoading.set(true);
    this.profileService.getUserInfo()
      .pipe(
        finalize(() => {
          if (showPageLoading) this.pageLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          if (!res.IsSuccess || !res.Data) {
            if (showErrorToast) this.showError('PROFILE.LOAD_ERROR');
            return;
          }

          this.setProfile(res.Data);
        },
        error: () => {
          if (showErrorToast) this.showError('PROFILE.LOAD_ERROR');
        },
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('COMMON.INVALID_FILE'),
        detail: this.translate.instant('PROFILE.INVALID_IMAGE_TYPE'),
      });
      input.value = '';
      return;
    }

    const userId = this.currentUserId();
    if (!userId) {
      this.showError('PROFILE.IMAGE_UPLOAD_ERROR');
      input.value = '';
      return;
    }

    this.revokeObjectAvatarUrl();
    this.objectAvatarUrl = URL.createObjectURL(file);
    this.avatarPreviewUrl.set(this.objectAvatarUrl);
    this.imageUploading.set(true);

    this.profileService.uploadUserImage(userId, file)
      .pipe(
        finalize(() => {
          this.imageUploading.set(false);
          input.value = '';
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.showError('PROFILE.IMAGE_UPLOAD_ERROR');
            this.avatarPreviewUrl.set(this.resolveAvatarUrl(this.profile()?.AvatarUrl));
            return;
          }

          this.showSuccess('PROFILE.IMAGE_UPLOAD_SUCCESS');
          this.loadProfile(false, false);
        },
        error: () => {
          this.showError('PROFILE.IMAGE_UPLOAD_ERROR');
          this.avatarPreviewUrl.set(this.resolveAvatarUrl(this.profile()?.AvatarUrl));
        },
      });
  }

  saveProfile(): void {
    this.profileValidationErrors.set({});
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.profileSaving()) return;

    const userId = this.currentUserId();
    if (!userId) {
      this.showError('PROFILE.UPDATE_ERROR');
      return;
    }

    this.profileSaving.set(true);
    const payload = {
      Id: userId,
      ...this.profileForm.getRawValue(),
    };

    this.profileService.updateUserProfile(payload)
      .pipe(
        finalize(() => this.profileSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.profileValidationErrors.set(this.mapValidationErrors(res.ValidationErrors));
            this.showError('PROFILE.UPDATE_ERROR');
            return;
          }

          const current = this.profile();
          if (current) this.setProfile({ ...current, ...payload });
          this.auth.updateCurrentUser({
            displayName: payload.DisplayName,
            email: payload.Email,
          });
          this.showSuccess('PROFILE.UPDATE_SUCCESS');
          this.loadProfile(false, false);
        },
        error: () => this.showError('PROFILE.UPDATE_ERROR'),
      });
  }

  resetPassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordMismatch() || this.passwordSaving()) return;

    const { OldPassword, NewPassword } = this.passwordForm.getRawValue();

    this.passwordSaving.set(true);
    this.profileService.resetPassword({ OldPassword, NewPassword })
      .pipe(
        finalize(() => this.passwordSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.showError('PROFILE.PASSWORD_RESET_ERROR');
            return;
          }

          this.passwordForm.reset();
          this.showSuccess('PROFILE.PASSWORD_RESET_SUCCESS');
        },
        error: () => this.showError('PROFILE.PASSWORD_RESET_ERROR'),
      });
  }

  fieldInvalid(fieldName: 'DisplayName' | 'Email' | 'Phone'): boolean {
    const control = this.profileForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  passwordFieldInvalid(fieldName: 'OldPassword' | 'NewPassword' | 'ConfirmPassword'): boolean {
    const control = this.passwordForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  passwordMismatch(): boolean {
    const { NewPassword, ConfirmPassword } = this.passwordForm.getRawValue();
    return !!NewPassword && !!ConfirmPassword && NewPassword !== ConfirmPassword;
  }

  validationError(fieldName: string): string {
    return this.profileValidationErrors()[fieldName.toLowerCase()] ?? '';
  }

  displayValue(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || this.translate.instant('COMMON.NOT_AVAILABLE');
  }

  formatDate(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(this.translate.currentLang || 'en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private setProfile(profile: UserProfile): void {
    this.revokeObjectAvatarUrl();
    this.profile.set(profile);
    this.profileForm.patchValue({
      DisplayName: profile.DisplayName ?? '',
      Email: profile.Email ?? '',
      Phone: profile.Phone ?? '',
    });
    this.profileValidationErrors.set({});
    this.avatarPreviewUrl.set(this.resolveAvatarUrl(profile.AvatarUrl));
  }

  private resolveAvatarUrl(path?: string): string {
    const trimmed = path?.trim();
    if (!trimmed) return '';
    if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    const base = environment.uploadsBase.replace(/\/$/, '');
    const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${base}${relativePath}`;
  }

  private roleKey(role: unknown): string {
    const normalized = String(role ?? '').toLowerCase();
    if (normalized === '4' || normalized === 'superadmin' || normalized === 'super_admin') return 'PROFILE.ROLES.SUPER_ADMIN';
    if (normalized === '3' || normalized === 'admin') return 'PROFILE.ROLES.COMPANY_ADMIN';
    if (normalized === '2' || normalized === 'supervisor') return 'PROFILE.ROLES.SUPERVISOR';
    if (normalized === '1' || normalized === 'family') return 'PROFILE.ROLES.FAMILY';
    if (normalized === '0' || normalized === 'pilgrim') return 'PROFILE.ROLES.PILGRIM';
    return 'PROFILE.ROLES.UNKNOWN';
  }

  private mapValidationErrors(errors?: ValidationError[] | null): Record<string, string> {
    return (errors ?? []).reduce((acc, item) => {
      acc[item.PropertyName.toLowerCase()] = item.ErrorMessage;
      return acc;
    }, {} as Record<string, string>);
  }

  private showSuccess(detailKey: string): void {
    this.toast.add({
      severity: 'success',
      summary: this.translate.instant('COMMON.SUCCESS'),
      detail: this.translate.instant(detailKey),
    });
  }

  private showError(detailKey: string): void {
    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('COMMON.ERROR'),
      detail: this.translate.instant(detailKey),
    });
  }

  private revokeObjectAvatarUrl(): void {
    if (!this.objectAvatarUrl) return;
    URL.revokeObjectURL(this.objectAvatarUrl);
    this.objectAvatarUrl = null;
  }
}
