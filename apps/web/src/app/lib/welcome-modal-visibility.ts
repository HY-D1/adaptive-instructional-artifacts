const AUTH_ROUTE_PATHS = new Set(['/login', '/signup']);

interface WelcomeModalVisibilityOptions {
  pathname: string;
  authBackendConfigured: boolean;
  isAuthenticated: boolean;
}

export function isWelcomeModalRouteEligible(pathname: string): boolean {
  return !AUTH_ROUTE_PATHS.has(pathname);
}

export function canOpenWelcomeModal(
  options: WelcomeModalVisibilityOptions,
): boolean {
  if (!isWelcomeModalRouteEligible(options.pathname)) {
    return false;
  }

  if (options.authBackendConfigured && !options.isAuthenticated) {
    return false;
  }

  return true;
}

export function shouldAutoShowWelcomeModal(
  options: WelcomeModalVisibilityOptions,
): boolean {
  return canOpenWelcomeModal(options);
}
