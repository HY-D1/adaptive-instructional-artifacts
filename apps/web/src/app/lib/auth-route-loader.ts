import { redirect } from 'react-router';
import type { LoaderFunction } from 'react-router';

import { AUTH_BACKEND_CONFIGURED, getMe } from './api/auth-client';
import {
  ROUTES,
  protectRoute,
  getDefaultRouteForRole,
  isPreviewModeActive,
} from './auth-guard';

export interface ProtectedLoaderOptions {
  requiredRole?: 'student' | 'instructor';
  allowAuthenticated?: boolean;
}

/**
 * Protected route loader factory.
 * Account mode is backend-authoritative; local-storage guards are used only
 * when backend auth is not configured.
 */
export function createProtectedLoader(options?: ProtectedLoaderOptions): LoaderFunction {
  return async () => {
    if (AUTH_BACKEND_CONFIGURED) {
      if (options?.allowAuthenticated) {
        return null;
      }
      const authUser = await getMe();
      if (!authUser) {
        return redirect(`${ROUTES.HOME}?reason=unauthorized`);
      }
      if (
        options?.requiredRole &&
        authUser.role !== options.requiredRole &&
        !(options.requiredRole === 'student' && authUser.role === 'instructor' && isPreviewModeActive())
      ) {
        return redirect(`${getDefaultRouteForRole(authUser.role)}?reason=access-denied`);
      }
      return null;
    }

    const result = protectRoute(options);
    if (!result.allowed && result.redirect) {
      const redirectTo = result.redirect === ROUTES.LOGIN ? ROUTES.HOME : result.redirect;
      return redirect(redirectTo);
    }
    return null;
  };
}
