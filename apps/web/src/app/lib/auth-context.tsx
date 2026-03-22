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

// ============================================================================
// Context types
// ============================================================================

interface AuthContextValue {
  /** Null if not authenticated via account system */
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  signup: (params: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'instructor';
    instructorCode?: string;
  }) => Promise<AuthResult>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: false,
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

  /** Sync authenticated user into localStorage so existing guards work */
  function syncToLocalStorage(authUser: AuthUser) {
    storage.saveUserProfile({
      id: authUser.learnerId,
      name: authUser.name,
      role: authUser.role,
      createdAt: Date.now(),
    });
  }

  // On mount: check JWT cookie
  useEffect(() => {
    if (!AUTH_ENABLED) {
      setIsLoading(false);
      return;
    }
    getMe().then((authUser) => {
      if (authUser) {
        setUser(authUser);
        syncToLocalStorage(authUser);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await apiLogin(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      syncToLocalStorage(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    storage.clearUserProfile();
  }, []);

  const signup = useCallback(async (params: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'instructor';
    instructorCode?: string;
  }): Promise<AuthResult> => {
    const result = await apiSignup(params);
    if (result.success && result.user) {
      setUser(result.user);
      syncToLocalStorage(result.user);
    }
    return result;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
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
