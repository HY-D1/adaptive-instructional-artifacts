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

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  AUTH_ENABLED,
  AUTH_BACKEND_CONFIGURED,
} from './api/auth-client';
import type { AuthUser, AuthResult, LogoutResult } from './api/auth-client';
import { storage } from './storage/index';
import { clearUiStateForActor } from './ui-state';

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
    syncInfo: { hadExistingProfile: boolean; previousLearnerId: string | null }
  ): Promise<void> {
    if (!AUTH_ENABLED) return;
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
      
      if (authUser.role === 'instructor') {
        await storage.hydrateInstructorDashboard();
      }
      
      console.info('[auth_hydration_complete]', {
        learnerId: authUser.learnerId,
        success: hydrated,
        durationMs: Date.now() - hydrationStart,
        hadExistingProfile: syncInfo.hadExistingProfile,
        hadLegacyData: hasLegacyData,
      });
    } catch (error) {
      console.error('[auth_hydration_error]', {
        learnerId: authUser.learnerId,
        error: error instanceof Error ? error.message : 'unknown',
        durationMs: Date.now() - hydrationStart,
      });
      // Don't throw - login should succeed even if hydration fails
      // The storage layer will fall back to local data
    } finally {
      setIsHydrating(false);
    }
  }

  // On mount: check JWT cookie
  useEffect(() => {
    if (!AUTH_ENABLED) {
      setIsLoading(false);
      return;
    }
    getMe().then(async (authUser) => {
      if (authUser) {
        const syncInfo = syncToLocalStorage(authUser);
        await hydrateFromBackend(authUser, syncInfo);
        setUser(authUser);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await apiLogin(email, password);
    if (result.success && result.user) {
      if (user?.learnerId && user.learnerId !== result.user.learnerId) {
        clearUiStateForActor(user.learnerId);
      }
      const syncInfo = syncToLocalStorage(result.user);
      await hydrateFromBackend(result.user, syncInfo);
      setUser(result.user);
    }
    return result;
  }, [user]);

  const logout = useCallback(async (): Promise<LogoutResult> => {
    let result = await apiLogout();
    if (!result.success && result.status === 403 && AUTH_BACKEND_CONFIGURED) {
      // CSRF token can be stale after long-lived sessions; refresh once and retry.
      await getMe();
      result = await apiLogout();
    }
    if (!result.success && AUTH_BACKEND_CONFIGURED && result.status !== 401) {
      return result;
    }
    if (user?.learnerId) {
      clearUiStateForActor(user.learnerId);
    }
    setUser(null);
    storage.clearUserProfile();
    return { success: true };
  }, [user]);

  const signup = useCallback(async (params: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'instructor';
    classCode?: string;
    instructorCode?: string;
  }): Promise<AuthResult> => {
    const result = await apiSignup(params);
    if (result.success && result.user) {
      if (user?.learnerId && user.learnerId !== result.user.learnerId) {
        clearUiStateForActor(user.learnerId);
      }
      const syncInfo = syncToLocalStorage(result.user);
      await hydrateFromBackend(result.user, syncInfo);
      setUser(result.user);
    }
    return result;
  }, [user]);

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
