import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { PermissionRule } from '../permissions';

/**
 * Feature routes: `data.permission` (one permission, or a list where any one is enough) or `data.adminOnly`.
 * The company manager passes everything. A staff member without the permission is quietly sent to the first
 * section they may use (or the "no access" page) - no error toast on normal navigation.
 */
export const permissionGuard: CanActivateFn = route => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth = inject(AuthService);
  const router = inject(Router);

  const adminOnly = route.data?.['adminOnly'] === true;
  const permission = route.data?.['permission'] as PermissionRule | undefined;

  const allowed = adminOnly ? auth.isAdmin() : auth.hasPermission(permission);
  return allowed ? true : router.createUrlTree([auth.defaultRoute()]);
};
