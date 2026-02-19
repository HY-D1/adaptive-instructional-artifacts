import { useState, useEffect, useCallback } from 'react';
import type { UserRole, UserProfile } from '../types';
import { storage } from '../lib/storage';

const DEFAULT_ROLE: UserRole = 'student';

/**
 * Hook for managing user role and profile state
 * 
 * Features:
 * - Load/save profile to localStorage
 * - Role switching with profile persistence
 * - Profile updates (name, role)
 * 
 * @returns Object with role state, profile, and update functions
 * 
 * @example
 * ```typescript
 * const { role, setRole, profile, isStudent, isInstructor } = useUserRole();
 * ```
 */
export function useUserRole() {
  const [role, setRoleState] = useState<UserRole>(DEFAULT_ROLE);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, []);

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
