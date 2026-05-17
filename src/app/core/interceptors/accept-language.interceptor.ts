import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { TranslationService } from '../services/translation.service';

export const acceptLanguageInterceptor: HttpInterceptorFn = (req, next) => {
  // Don't touch i18n asset requests — those resolve their own path.
  if (req.url.includes('/assets/i18n/')) {
    return next(req);
  }

  const lang = inject(TranslationService).currentLang() || 'ar';

  return next(req.clone({ setHeaders: { 'Accept-Language': lang } }));
};
