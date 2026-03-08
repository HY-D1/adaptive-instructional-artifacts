import { useState, useEffect, useCallback } from 'react';
import type { UserRole, UserProfile } from '../types';
import { storage } from '../lib/storage/storage';

const DEFAULT_ROLE: UserRole = 'student';

interface UseUserRoleOptions {
  /** External profile from useSessionPersistence for sync */
  syncedProfile?: UserProfile | null;
  /** External loading state from useSessionPersistence */
  syncedLoading?: boolean;
}

/**
 * Hook for managing user role and profile state
 * 
 * Features:
 * - Load/save profile to localStorage
 * - Role switching with profile persistence
 * - Profile updates (name, role)
 * - Sync with useSessionPersistence for cross-tab consistency
 * 
 * @param options - Optional sync options to connect with useSessionPersistence
 * @returns Object with role state, profile, and update functions
 * 
 * @example
 * ```typescript
 * const { role, setRole, profile, isStudent, isInstructor } = useUserRole();
 * 
 * // Or with sync from useSessionPersistence:
 * const { profile: syncedProfile, isLoading: syncedLoading } = useSessionPersistence();
 * const { role, isStudent, isInstructor } = useUserRole({ syncedProfile, syncedLoading });
 * ```
 */
export function useUserRole(options?: UseUserRoleOptions) {
  const { syncedProfile, syncedLoading } = options || {};
  
  const [role, setRoleState] = useState<UserRole>(DEFAULT_ROLE);
  const [profile, setProfile] = useState<UserProfile | null>(syncedProfile ?? null);
  const [isLoading, setIsLoading] = useState(syncedLoading ?? true);

  // Sync with external profile from useSessionPersistence
  useEffect(() => {
    if (syncedProfile !== undefined) {
      setProfile(syncedProfile);
      setRoleState(syncedProfile?.role ?? DEFAULT_ROLE);
    }
  }, [syncedProfile]);

  // Sync loading state
  useEffect(() => {
    if (syncedLoading !== undefined) {
      setIsLoading(syncedLoading);
    }
  }, [syncedLoading]);

  // Initial load from storage (only if no synced profile provided)
  useEffect(() => {
    // Skip if we're using synced profile from useSessionPersistence
    if (syncedProfile !== undefined) {
      return;
    }
    
    // Load from storage module
    try {
      const storedProfile = storage.getUserProfile();
      if (storedProfile) {
        setProfile(storedProfile);
        setRoleState(storedProfile.role);
      } else {
        setRoleState(DEFAULT_ROLE);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setRoleState(DEFAULT_ROLE);
    }
    setIsLoading(false);
  }, [syncedProfile]);

  const setRole = useCallback((newRole: UserRole) => {
    const currentProfile = storage.getUserProfile();
    if (currentProfile) {
      // Update existing profile
      const updatedProfile: UserProfile = { ...currentProfile, role: newRole };
      storage.saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
    } else {
      // Create new profile
      const newProfile: UserProfile = {
        id: `user-${Date.now()}`,
        name: 'User',
        role: newRole,
        createdAt: Date.now(),
      };
      storage.saveUserProfile(newProfile);
      setProfile(newProfile);
    }
    
    setRoleState(newRole);
  }, []);

  const updateProfile = useCallback((updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => {
    const currentProfile = storage.getUserProfile();
    if (currentProfile) {
      const updatedProfile: UserProfile = { ...currentProfile, ...updates };
      storage.saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
      if (updates.role) {
        setRoleState(updates.role);
      }
    }
  }, []);

  const clearProfile = useCallback(() => {
    storage.clearUserProfile();
    setProfile(null);
    setRoleState(DEFAULT_ROLE);
  }, []);

  const isStudent = role === 'student';
  const isInstructor = role === 'instructor';

  return {
    role,
    setRole,
    profile,
    updateProfile,
    clearProfile,
    isStudent,
    isInstructor,
    isLoading,
  };
}
