import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/services/auth';
import { SUPPORTED_LANGUAGES, TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslateModule],
  host: { style: 'display: block; height: 100vh;' },
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private message   = inject(MessageService);
  private translate = inject(TranslateService);
  private elRef = inject(ElementRef);

  readonly translation = inject(TranslationService);
  readonly languages = SUPPORTED_LANGUAGES;

  form = this.fb.nonNullable.group({
    emailOrPhone: ['', Validators.required],
    password:     ['', Validators.required],
  });

  loading      = signal(false);
  showPassword = signal(false);
  rememberMe   = signal(false);
  hasError     = signal(false);
  langDropOpen = signal(false);

  toggleLangDrop(): void {
    this.langDropOpen.update(v => !v);
  }

  selectLang(code: string): void {
    this.translation.setLanguage(code);
    this.langDropOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.langDropOpen.set(false);
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { emailOrPhone, password } = this.form.getRawValue();

    this.hasError.set(false);
    this.auth.login(emailOrPhone, password).subscribe({
      next: () => {
        this.router.navigate(['/campaigns']).then(() => {
          this.message.add({
            severity: 'success',
            summary: this.translate.instant('LOGIN.SUCCESS_SUMMARY'),
            detail: this.translate.instant('LOGIN.SUCCESS_DETAIL'),
            life: 3000,
          });
        });
      },
      error: () => {
        this.hasError.set(true);
        this.message.add({
          severity: 'error',
          summary: this.translate.instant('LOGIN.ERROR_SUMMARY'),
          detail: this.translate.instant('LOGIN.ERROR_DETAIL'),
          life: 4000,
        });
        this.loading.set(false);
      },
    });
  }
}
