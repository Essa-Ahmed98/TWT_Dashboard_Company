import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const noAuthGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return router.createUrlTree(['/']);

  return true;
};
