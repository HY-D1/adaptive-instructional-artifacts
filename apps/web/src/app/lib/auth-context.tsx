/**
 * AuthContext
 *
 * Provides account-based auth state to the app. On mount it checks the JWT
 * cookie via GET /api/auth/me. If authenticated, it also populates the local
 * storage profile so existing routes and guards keep working unchanged.
 *
 * Falls back gracefully: if VITE_API_BASE_URL is not set or the backend is
 * unreachable, AUTH_ENABLED is false and the context is a no-op (the existing
 * localStorage-passcode flow handles auth instead).
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, signup as apiSignup, AUTH_ENABLED } from './api/auth-client';
import type { AuthUser, AuthResult } from './api/auth-client';
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
  logout: () => Promise<void>;
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
  logout: async () => {},
  signup: async () => ({ success: false, error: 'AuthProvider not mounted' }),
});

// ============================================================================
// Provider
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(AUTH_ENABLED);
  const [isHydrating, setIsHydrating] = useState(false);

  /** Sync authenticated user into localStorage so existing guards work */
  function syncToLocalStorage(authUser: AuthUser) {
    storage.saveUserProfile({
      id: authUser.learnerId,
      name: authUser.name,
      role: authUser.role,
      createdAt: Date.now(),
    });
  }

  async function hydrateFromBackend(authUser: AuthUser): Promise<void> {
    if (!AUTH_ENABLED) return;
    setIsHydrating(true);
    try {
      await storage.hydrateLearner(authUser.learnerId);
      if (authUser.role === 'instructor') {
        await storage.hydrateInstructorDashboard();
      }
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
        syncToLocalStorage(authUser);
        await hydrateFromBackend(authUser);
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
      syncToLocalStorage(result.user);
      await hydrateFromBackend(result.user);
      setUser(result.user);
    }
    return result;
  }, [user]);

  const logout = useCallback(async () => {
    await apiLogout();
    if (user?.learnerId) {
      clearUiStateForActor(user.learnerId);
    }
    setUser(null);
    storage.clearUserProfile();
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
      syncToLocalStorage(result.user);
      await hydrateFromBackend(result.user);
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
