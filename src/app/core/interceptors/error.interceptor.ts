import { Injector, inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ApiResult } from '../models/api.models';
import { AuthService } from '../auth/services/auth';

const API_ERRORS: Record<string, string> = {
  'This username is already taken.': 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل',
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const message = inject(MessageService);
  const injector = inject(Injector);
  const isLoginRequest = req.url.includes('/Users/login');

  const handle = (error: HttpErrorResponse, body: unknown): Observable<never> => {
    let detail = 'حدث خطأ غير متوقع';
    let hasApiMessage = false;

    if (body) {
      const apiBody = body as ApiResult<unknown>;
      const rawKey = apiBody?.Error?.MessageKey || apiBody?.Error?.message;

      if (rawKey) {
        detail = API_ERRORS[rawKey] ?? rawKey;
        hasApiMessage = true;
      } else if (apiBody?.ValidationErrors?.length) {
        detail = apiBody.ValidationErrors.map((v) => v.ErrorMessage).join('\n');
        hasApiMessage = true;
      } else if (typeof body === 'string') {
        detail = body;
        hasApiMessage = true;
      }
    }

    if (error.status === 0) {
      detail = 'تعذر الاتصال بالخادم';
    } else if (error.status === 401) {
      // session expired / token rejected: clear the session and go back to the login page (once)
      const auth = injector.get(AuthService); // resolved lazily to avoid a circular DI chain
      if (auth.getToken()) {
        message.add({
          severity: 'error',
          summary: 'خطأ',
          detail: hasApiMessage ? detail : 'انتهت الجلسة، من فضلك سجل الدخول مرة أخرى',
          life: 4000,
        });
        auth.logout();
      }
      return throwError(() => error);
    } else if (error.status === 403 && !hasApiMessage) {
      detail = 'ليس لديك صلاحية للوصول';
    } else if (error.status === 404 && !hasApiMessage) {
      detail = 'المورد المطلوب غير موجود';
    }

    message.add({ severity: 'error', summary: 'خطأ', detail, life: 4000 });

    return throwError(() => error);
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isLoginRequest) return throwError(() => error);

      // file downloads (responseType: 'blob') get the JSON error body as a Blob - read it first
      if (typeof Blob !== 'undefined' && error.error instanceof Blob && /json/i.test(error.error.type)) {
        return from(error.error.text()).pipe(
          switchMap((text) => {
            let parsed: unknown = null;
            try { parsed = JSON.parse(text); } catch { parsed = null; }
            return handle(error, parsed);
          })
        );
      }

      return handle(error, error.error);
    })
  );
};
