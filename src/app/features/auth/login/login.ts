import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  host: { style: 'display: block; height: 100vh;' },
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private fb      = inject(FormBuilder);
  private auth    = inject(AuthService);
  private router  = inject(Router);
  private message = inject(MessageService);

  form = this.fb.nonNullable.group({
    emailOrPhone: ['', Validators.required],
    password:     ['', Validators.required],
  });

  loading      = signal(false);
  showPassword = signal(false);
  rememberMe   = signal(false);
  hasError     = signal(false);

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
            summary: 'تم تسجيل الدخول',
            detail: 'مرحباً بك في لوحة الأدمن',
            life: 3000,
          });
        });
      },
      error: () => {
        this.hasError.set(true);
        this.message.add({
          severity: 'error',
          summary: 'خطأ في تسجيل الدخول',
          detail: 'من فضلك تأكد من البريد الإلكتروني أو رقم الهاتف وكلمة السر',
          life: 4000,
        });
        this.loading.set(false);
      },
    });
  }
}
