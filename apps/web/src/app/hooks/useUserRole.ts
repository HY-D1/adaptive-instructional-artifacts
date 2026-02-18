import { useState, useEffect, useCallback } from 'react';
import type { UserRole, UserProfile } from '../types';
import { storage } from '../lib/storage';

const DEFAULT_ROLE: UserRole = 'student';

export function useUserRole() {
  const [role, setRoleState] = useState<UserRole>(DEFAULT_ROLE);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from storage module
    const storedProfile = storage.getUserProfile();
    if (storedProfile) {
      setProfile(storedProfile);
      setRoleState(storedProfile.role);
    } else {
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
