import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ApiResult } from '../models/api.models';

const API_ERRORS: Record<string, string> = {
  'This username is already taken.': 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل',
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const message = inject(MessageService);
  const isLoginRequest = req.url.includes('/Users/login');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isLoginRequest) return throwError(() => error);
      let detail = 'حدث خطأ غير متوقع';

      if (error.error) {
        const body = error.error as ApiResult<unknown>;
        const rawKey = body?.Error?.MessageKey || body?.Error?.message;
        if (rawKey) {
          detail = API_ERRORS[rawKey] ?? rawKey;
        } else if (body?.ValidationErrors?.length) {
          detail = body.ValidationErrors.map((v) => v.ErrorMessage).join('\n');
        } else if (typeof error.error === 'string') {
          detail = error.error;
        }
      }

      if (error.status === 0) {
        detail = 'تعذّر الاتصال بالخادم';
      } else if (error.status === 401) {
        detail = 'غير مصرح لك بهذا الإجراء';
      } else if (error.status === 403) {
        detail = 'ليس لديك صلاحية للوصول';
      } else if (error.status === 404) {
        detail = 'المورد المطلوب غير موجود';
      }

      message.add({ severity: 'error', summary: 'خطأ', detail, life: 4000 });

      return throwError(() => error);
    })
  );
};
