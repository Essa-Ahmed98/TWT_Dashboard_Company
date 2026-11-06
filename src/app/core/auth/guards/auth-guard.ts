import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth = inject(AuthService);
  const router = inject(Router);

  // a token whose JWT `exp` is in the past counts as logged out, and only company admins may stay
  // (a session saved by an older build, e.g. a supervisor's, is cleared)
  if (auth.isLoggedIn() && !auth.isTokenExpired() && auth.currentUser()?.role === 'Admin') return true;

  if (auth.getToken()) auth.clearSession();
  return router.createUrlTree(['/auth/login']);
};
