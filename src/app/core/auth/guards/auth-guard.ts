import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth = inject(AuthService);
  const router = inject(Router);

  // a token whose JWT `exp` is in the past counts as logged out
  if (auth.isLoggedIn() && !auth.isTokenExpired()) return true;

  if (auth.getToken()) auth.clearSession();
  return router.createUrlTree(['/auth/login']);
};
