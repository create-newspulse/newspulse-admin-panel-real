export interface AdminShellBootstrapState {
  isAdminPanelPath: boolean;
  isAuthPage: boolean;
  isReady: boolean;
  isSessionResolved: boolean;
  isRestoring: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasVerifiedUserRole: boolean;
}

export function shouldBlockAdminShell({
  isAdminPanelPath,
  isAuthPage,
  isReady,
  isSessionResolved,
  isRestoring,
  isLoading,
  isAuthenticated,
  hasVerifiedUserRole,
}: AdminShellBootstrapState): boolean {
  return isAdminPanelPath
    && !isAuthPage
    && (!isReady || !isSessionResolved || isRestoring || isLoading || (isAuthenticated && !hasVerifiedUserRole));
}

export function shouldRedirectUnauthenticatedAdmin({
  isAdminPanelPath,
  isAuthPage,
  isReady,
  isSessionResolved,
  isAuthenticated,
}: Pick<AdminShellBootstrapState, 'isAdminPanelPath' | 'isAuthPage' | 'isReady' | 'isSessionResolved' | 'isAuthenticated'>): boolean {
  return isAdminPanelPath && !isAuthPage && isReady && isSessionResolved && !isAuthenticated;
}