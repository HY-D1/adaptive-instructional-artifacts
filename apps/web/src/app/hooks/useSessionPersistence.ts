/**
 * useSessionPersistence Hook
 * 
 * React hook that syncs user profile state across browser tabs using localStorage.
 * 
 * Features:
 * - Cross-tab synchronization via StorageEvent API
 * - Toast notifications when profile changes in another tab
 * - Auto-redirect when profile is cleared externally
 * - Session expiry handling (7 days of inactivity)
 * - Safe SSR/localStorage handling
 * 
 * @module useSessionPersistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import type { UserProfile } from '../types';
import { storage } from '../lib/storage';
import { emitProfileUpdated, emitProfileCleared } from '../lib/session-events';

/**
 * Source of the last sync operation
 */
export type SyncSource = 'storage' | 'manual' | null;

/**
 * Return type for useSessionPersistence hook
 */
export interface UseSessionPersistenceReturn {
  /** Timestamp of last storage sync event (null if never synced) */
  lastSync: number | null;
  /** Source of the last profile update */
  source: SyncSource;
  /** Whether to show cross-tab sync toast notification */
  showSyncToast: boolean;
  /** Function to dismiss the sync toast */
  dismissToast: () => void;
  /** Current profile state (null if not loaded or cleared) */
  profile: UserProfile | null;
  /** Whether profile is currently loading */
  isLoading: boolean;
  /** Check if session has expired (7+ days inactive) */
  isSessionExpired: boolean;
  /** Update the lastActiveAt timestamp */
  updateActivity: () => void;
}

/**
 * Session expiry threshold in milliseconds (7 days)
 */
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * localStorage key for last activity timestamp
 */
const LAST_ACTIVE_KEY = 'sql-adapt-last-active';

/**
 * localStorage key for user profile (must match storage.ts)
 */
const USER_PROFILE_KEY = 'sql-adapt-user-profile';

/**
 * React hook for cross-tab session persistence
 * 
 * @example
 * ```typescript
 * function RootLayout() {
 *   const { showSyncToast, dismissToast, isSessionExpired } = useSessionPersistence();
 *   
 *   return (
 *     <div>
 *       {showSyncToast && <SyncToast onClose={dismissToast} />}
 *       // ... rest of component
 *     </div>
 *   );
 * }
 * ```
 */
export function useSessionPersistence(): UseSessionPersistenceReturn {
  const navigate = useNavigate();
  
  // State
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [source, setSource] = useState<SyncSource>(null);
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  
  // Refs for stable callback references
  const isMountedRef = useRef(true);
  const currentProfileRef = useRef<UserProfile | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  /**
   * Get last activity timestamp from localStorage
   * Returns null if not found or invalid
   */
  const getLastActivity = useCallback((): number | null => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    
    try {
      const raw = localStorage.getItem(LAST_ACTIVE_KEY);
      if (!raw) return null;
      
      const timestamp = parseInt(raw, 10);
      return Number.isFinite(timestamp) ? timestamp : null;
    } catch {
      return null;
    }
  }, []);
  
  /**
   * Update last activity timestamp in localStorage
   */
  const updateActivity = useCallback((): void => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      const now = Date.now();
      localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
      setIsSessionExpired(false);
    } catch (error) {
      // Silently fail if localStorage is unavailable or quota exceeded
      console.warn('[useSessionPersistence] Failed to update activity timestamp:', error);
    }
  }, []);
  
  /**
   * Check if session has expired based on last activity
   */
  const checkSessionExpiry = useCallback((): boolean => {
    const lastActivity = getLastActivity();
    if (!lastActivity) return false;
    
    const now = Date.now();
    const expired = now - lastActivity > SESSION_EXPIRY_MS;
    return expired;
  }, [getLastActivity]);
  
  /**
   * Clear profile and redirect to start page
   */
  const handleSessionExpired = useCallback((): void => {
    if (!isMountedRef.current) return;
    
    const previousProfile = currentProfileRef.current;
    
    // Clear storage
    storage.clearUserProfile();
    localStorage.removeItem(LAST_ACTIVE_KEY);
    
    // Update state
    setProfile(null);
    currentProfileRef.current = null;
    setIsSessionExpired(true);
    
    // Emit event for same-tab listeners
    emitProfileCleared(previousProfile, 'storage');
    
    // Redirect to start page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);
  
  /**
   * Load profile from storage and check expiry
   */
  const loadProfile = useCallback((): void => {
    if (!isMountedRef.current) return;
    
    // Check for session expiry first
    if (checkSessionExpiry()) {
      handleSessionExpired();
      setIsLoading(false);
      return;
    }
    
    const loadedProfile = storage.getUserProfile();
    
    if (loadedProfile) {
      setProfile(loadedProfile);
      currentProfileRef.current = loadedProfile;
      
      // Update activity timestamp on successful load
      updateActivity();
    } else {
      setProfile(null);
      currentProfileRef.current = null;
    }
    
    setIsLoading(false);
  }, [checkSessionExpiry, handleSessionExpired, updateActivity]);
  
  /**
   * Handle storage events from other tabs
   */
  const handleStorageChange = useCallback((event: StorageEvent): void => {
    if (!isMountedRef.current) return;
    
    // Only handle our profile key
    if (event.key !== USER_PROFILE_KEY) return;
    
    const now = Date.now();
    
    // Profile was cleared in another tab
    if (event.newValue === null) {
      const previousProfile = currentProfileRef.current;
      
      setProfile(null);
      currentProfileRef.current = null;
      setLastSync(now);
      setSource('storage');
      
      // Emit event for same-tab listeners
      emitProfileCleared(previousProfile, 'storage');
      
      // Auto-redirect to start page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }
    
    // Profile was updated in another tab
    if (event.newValue) {
      try {
        const newProfile = JSON.parse(event.newValue) as UserProfile;
        const previousProfile = currentProfileRef.current;
        
        // Validate the parsed profile
        if (
          typeof newProfile.id === 'string' &&
          typeof newProfile.name === 'string' &&
          (newProfile.role === 'student' || newProfile.role === 'instructor') &&
          typeof newProfile.createdAt === 'number'
        ) {
          setProfile(newProfile);
          currentProfileRef.current = newProfile;
          setLastSync(now);
          setSource('storage');
          setShowSyncToast(true);
          
          // Emit event for same-tab listeners
          emitProfileUpdated(newProfile, previousProfile, 'storage');
          
          // Auto-dismiss toast after 5 seconds
          if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
          }
          toastTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setShowSyncToast(false);
            }
          }, 5000);
        }
      } catch (error) {
        console.error('[useSessionPersistence] Failed to parse profile from storage event:', error);
      }
    }
  }, []);
  
  /**
   * Dismiss the sync toast notification
   */
  const dismissToast = useCallback((): void => {
    setShowSyncToast(false);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    loadProfile();
    
    // Mark as mounted
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadProfile]);
  
  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    // Skip if SSR or localStorage not available
    if (typeof window === 'undefined' || !window.addEventListener) {
      return;
    }
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleStorageChange]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    lastSync,
    source,
    showSyncToast,
    dismissToast,
    profile,
    isLoading,
    isSessionExpired,
    updateActivity
  };
}

/**
 * Hook to track route changes and update activity timestamp
 * 
 * @example
 * ```typescript
 * function App() {
 *   useActivityTracker();
 *   return <Routes>...</Routes>;
 * }
 * ```
 */
export function useActivityTracker(): void {
  const { updateActivity } = useSessionPersistence();
  
  useEffect(() => {
    // Update activity on mount (route change)
    updateActivity();
  }, [updateActivity]);
  
  // Also update on visibility change (user returns to tab)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateActivity]);
}

/**
 * Hook to get a function that saves profile and emits events
 * 
 * @example
 * ```typescript
 * const saveProfile = useSaveProfile();
 * saveProfile({ name: 'New Name' });
 * ```
 */
export function useSaveProfile(): (
  updates: Partial<import('../types').UserProfile>
) => void {
  const { profile } = useSessionPersistence();
  
  return useCallback(
    (updates: Partial<UserProfile>): void => {
      const currentProfile = storage.getUserProfile();
      if (!currentProfile) return;
      
      const newProfile: UserProfile = { ...currentProfile, ...updates };
      storage.saveUserProfile(newProfile);
      
      // Emit same-tab event (storage event handles cross-tab)
      emitProfileUpdated(newProfile, currentProfile, 'manual');
    },
    [profile]
  );
}

/**
 * Hook to get a function that clears profile and emits events
 * 
 * @example
 * ```typescript
 * const clearProfile = useClearProfile();
 * clearProfile(); // Clears and redirects
 * ```
 */
export function useClearProfile(): () => void {
  return useCallback((): void => {
    const previousProfile = storage.getUserProfile();
    
    storage.clearUserProfile();
    localStorage.removeItem(LAST_ACTIVE_KEY);
    
    // Emit same-tab event
    emitProfileCleared(previousProfile, 'manual');
    
    // Redirect
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);
}
