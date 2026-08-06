/**
 * AuthContext
 *
 * Provides account-based auth state to the app. On mount it checks the JWT
 * cookie via GET /api/auth/me. If authenticated, it also populates the local
 * storage profile as a UX cache.
 *
 * When VITE_API_BASE_URL is not configured, account auth is disabled and the
 * existing local passcode flow remains active. In dev mode with a configured
 * backend URL, AUTH_ENABLED stays true and route protection is backend-auth
 * authoritative.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  getMe,
  probeAuthSession,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  AUTH_ENABLED,
  AUTH_BACKEND_CONFIGURED,
} from './api/auth-client';
import type { AuthUser, AuthResult, LogoutResult } from './api/auth-client';
import { storage } from './storage/index';
import { clearUiStateForActor } from './ui-state';
import { setActiveSyncPrincipal } from './storage/sync-owner';

// ============================================================================
// Context types
// ============================================================================

interface AuthContextValue {
  /** Null if not authenticated via account system */
  user: AuthUser | null;
  isLoading: boolean;
  isHydrating: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<LogoutResult>;
  signup: (params: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'instructor';
    classCode?: string;
    instructorCode?: string;
  }) => Promise<AuthResult>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: false,
  isHydrating: false,
  isAuthenticated: false,
  login: async () => ({ success: false, error: 'AuthProvider not mounted' }),
  logout: async () => ({ success: false, error: 'AuthProvider not mounted' }),
  signup: async () => ({ success: false, error: 'AuthProvider not mounted' }),
});

// ============================================================================
// Provider
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(AUTH_ENABLED);
  const [isHydrating, setIsHydrating] = useState(false);
  const authOperationRef = useRef(0);

  const beginAuthOperation = useCallback((): number => {
    authOperationRef.current += 1;
    setIsHydrating(false);
    return authOperationRef.current;
  }, []);

  const isCurrentAuthOperation = useCallback(
    (operation: number): boolean => authOperationRef.current === operation,
    [],
  );

  /** 
   * Sync authenticated user into localStorage so existing guards work.
   * Preserves existing local profile createdAt when available to maintain
   * accurate account creation metadata.
   */
  function syncToLocalStorage(authUser: AuthUser): {
    hadExistingProfile: boolean;
    preservedCreatedAt: number | null;
    previousLearnerId: string | null;
  } {
    // Check for existing profile to preserve metadata
    const existingProfile = storage.getUserProfile();
    const hadExistingProfile = existingProfile !== null;
    const previousLearnerId = existingProfile?.id ?? null;
    
    // Preserve createdAt from existing profile if available, otherwise use now
    // This prevents resetting the creation date on every login
    const preservedCreatedAt = existingProfile?.createdAt ?? Date.now();
    
    const auditInfo = {
      action: hadExistingProfile ? 'profile_update' : 'profile_create',
      learnerId: authUser.learnerId,
      previousLearnerId,
      hadExistingProfile,
      preservedCreatedAt,
      newCreatedAt: Date.now(),
    };
    
    // Log for data integrity auditing
    console.info('[auth_hydration_profile_sync]', auditInfo);
    
    storage.saveUserProfile({
      id: authUser.learnerId,
      name: authUser.name,
      role: authUser.role,
      createdAt: preservedCreatedAt,
    });
    
    return {
      hadExistingProfile,
      preservedCreatedAt,
      previousLearnerId,
    };
  }

  async function hydrateFromBackend(
    authUser: AuthUser,
    syncInfo: { hadExistingProfile: boolean; previousLearnerId: string | null },
    operation: number,
  ): Promise<void> {
    if (!AUTH_ENABLED || !isCurrentAuthOperation(operation)) return;
    setIsHydrating(true);
    
    const hydrationStart = Date.now();
    
    try {
      // Detect potential legacy data scenario
      const hasLegacyData = syncInfo.previousLearnerId && 
        syncInfo.previousLearnerId !== authUser.learnerId;
      
      if (hasLegacyData) {
        console.info('[auth_hydration_legacy_detected]', {
          previousLearnerId: syncInfo.previousLearnerId,
          newLearnerId: authUser.learnerId,
          action: 'preserving_local_data',
          note: 'Local data under previous learnerId will be preserved but not migrated to backend',
        });
      }
      
      const hydrated = await storage.hydrateLearner(authUser.learnerId);
      if (!isCurrentAuthOperation(operation)) return;
      
      if (authUser.role === 'instructor') {
        await storage.hydrateInstructorDashboard();
        if (!isCurrentAuthOperation(operation)) return;
      }
      
      console.info('[auth_hydration_complete]', {
        learnerId: authUser.learnerId,
        success: hydrated,
        durationMs: Date.now() - hydrationStart,
        hadExistingProfile: syncInfo.hadExistingProfile,
        hadLegacyData: hasLegacyData,
      });
    } catch (error) {
      if (!isCurrentAuthOperation(operation)) return;
      console.error('[auth_hydration_error]', {
        learnerId: authUser.learnerId,
        error: error instanceof Error ? error.message : 'unknown',
        durationMs: Date.now() - hydrationStart,
      });
      // Don't throw - login should succeed even if hydration fails
      // The storage layer will fall back to local data
    } finally {
      if (isCurrentAuthOperation(operation)) {
        setIsHydrating(false);
      }
    }
  }

  async function commitAuthenticatedUser(authUser: AuthUser, operation: number): Promise<void> {
    if (!isCurrentAuthOperation(operation)) return;
    setActiveSyncPrincipal({
      accountId: authUser.id,
      learnerId: authUser.learnerId,
    });
    if (user?.learnerId && user.learnerId !== authUser.learnerId) {
      clearUiStateForActor(user.learnerId);
    }
    const syncInfo = syncToLocalStorage(authUser);
    await hydrateFromBackend(authUser, syncInfo, operation);
    if (!isCurrentAuthOperation(operation)) return;
    setUser(authUser);
  }

  async function reconcileAuthenticatedSession(operation: number): Promise<void> {
    const session = await probeAuthSession();
    if (!isCurrentAuthOperation(operation)) return;
    if (session.state === 'unauthenticated') {
      setUser(null);
      return;
    }
    if (session.state === 'authenticated') {
      await commitAuthenticatedUser(session.user, operation);
    }
  }

  // On mount: check JWT cookie
  useEffect(() => {
    const operation = beginAuthOperation();
    setActiveSyncPrincipal(null);
    if (!AUTH_ENABLED) {
      setIsLoading(false);
      return;
    }
    getMe().then(async (authUser) => {
      if (!isCurrentAuthOperation(operation)) return;
      if (authUser) {
        setActiveSyncPrincipal({
          accountId: authUser.id,
          learnerId: authUser.learnerId,
        });
        const syncInfo = syncToLocalStorage(authUser);
        await hydrateFromBackend(authUser, syncInfo, operation);
        if (!isCurrentAuthOperation(operation)) return;
        setUser(authUser);
      }
      if (isCurrentAuthOperation(operation)) {
        setIsLoading(false);
      }
    });
    return () => {
      if (isCurrentAuthOperation(operation)) {
        authOperationRef.current += 1;
      }
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const operation = beginAuthOperation();
    setIsLoading(false);
    setActiveSyncPrincipal(null);
    const result = await apiLogin(email, password);
    if (!isCurrentAuthOperation(operation)) return result;
    if (result.success && result.user) {
      await commitAuthenticatedUser(result.user, operation);
    } else {
      await reconcileAuthenticatedSession(operation);
    }
    return result;
  }, [beginAuthOperation, isCurrentAuthOperation, user]);

  const logout = useCallback(async (): Promise<LogoutResult> => {
    const operation = beginAuthOperation();
    setIsLoading(false);
    const result = await apiLogout();
    if (!isCurrentAuthOperation(operation)) return result;
    setActiveSyncPrincipal(null);
    // Idempotent teardown: always clear local auth state first so a failed
    // server logout (403/500/network) can never trap the user in a
    // half-logged-in screen. A 401 means the session was already gone.
    if (user?.learnerId) {
      clearUiStateForActor(user.learnerId);
    }
    setUser(null);
    storage.clearUserProfile();
    // Surface a genuine server-side failure to the caller; local state is
    // cleared regardless of what we return here.
    if (!result.success && AUTH_BACKEND_CONFIGURED && result.status !== 401) {
      return result;
    }
    return { success: true };
  }, [beginAuthOperation, isCurrentAuthOperation, user]);

  const signup = useCallback(async (params: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'instructor';
    classCode?: string;
    instructorCode?: string;
  }): Promise<AuthResult> => {
    const operation = beginAuthOperation();
    setIsLoading(false);
    setActiveSyncPrincipal(null);
    const result = await apiSignup(params);
    if (!isCurrentAuthOperation(operation)) return result;
    if (result.success && result.user) {
      await commitAuthenticatedUser(result.user, operation);
    } else {
      await reconcileAuthenticatedSession(operation);
    }
    return result;
  }, [beginAuthOperation, isCurrentAuthOperation, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isHydrating,
        isAuthenticated: user !== null,
        login,
        logout,
        signup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
