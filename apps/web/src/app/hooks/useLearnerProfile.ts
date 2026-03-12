/**
 * useLearnerProfile Hook
 * 
 * React hook for managing learner profiles with:
 * - Automatic backend synchronization
 * - Local caching for offline support
 * - Event-driven profile updates
 * - Real-time profile state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LearnerProfile, InteractionEvent } from '../types';
import learnerProfileClient from '../lib/api/learner-profile-client';

interface UseLearnerProfileOptions {
  autoSync?: boolean;
  syncInterval?: number;
  onSyncError?: (error: Error) => void;
}

interface UseLearnerProfileReturn {
  profile: LearnerProfile | null;
  isLoading: boolean;
  isSyncing: boolean;
  pendingUpdates: number;
  error: Error | null;
  
  // Actions
  refresh: () => Promise<void>;
  saveProfile: (profile: LearnerProfile) => Promise<boolean>;
  updateFromEvent: (event: InteractionEvent) => Promise<void>;
  batchUpdate: (events: InteractionEvent[]) => Promise<void>;
  syncNow: () => Promise<boolean>;
  
  // Status
  isOffline: boolean;
  hasPendingUpdates: boolean;
}

/**
 * Hook for managing a single learner's profile
 */
export function useLearnerProfile(
  learnerId: string | null,
  options: UseLearnerProfileOptions = {}
): UseLearnerProfileReturn {
  const { autoSync = true, onSyncError } = options;
  
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(!learnerProfileClient.isBackendAvailable());
  
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Get pending updates count
  const pendingUpdates = learnerId ? learnerProfileClient.getPendingUpdateCount(learnerId) : 0;
  const hasPendingUpdates = pendingUpdates > 0;
  
  // Load profile from cache or backend
  const loadProfile = useCallback(async (forceRefresh = false) => {
    if (!learnerId) {
      setProfile(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await learnerProfileClient.getProfile(learnerId, forceRefresh);
      setProfile(data);
      
      // Check backend status
      const health = await learnerProfileClient.checkBackendHealth();
      setIsOffline(!health);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load profile');
      setError(error);
      console.error('[useLearnerProfile] Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);
  
  // Initial load
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);
  
  // Auto-sync setup
  useEffect(() => {
    if (!learnerId || !autoSync) return;
    
    // Set up sync interval
    syncIntervalRef.current = setInterval(() => {
      if (learnerProfileClient.hasPendingUpdates(learnerId)) {
        syncNow().catch(err => {
          console.error('[useLearnerProfile] Auto-sync failed:', err);
          onSyncError?.(err);
        });
      }
    }, 30000); // 30 seconds
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [learnerId, autoSync, onSyncError]);
  
  // Refresh profile
  const refresh = useCallback(async () => {
    await loadProfile(true);
  }, [loadProfile]);
  
  // Save profile
  const saveProfile = useCallback(async (newProfile: LearnerProfile): Promise<boolean> => {
    setIsSyncing(true);
    
    try {
      const success = await learnerProfileClient.saveProfile(newProfile);
      if (success) {
        setProfile(newProfile);
      }
      return success;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save profile');
      setError(error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);
  
  // Update profile from a single event
  const updateFromEvent = useCallback(async (event: InteractionEvent) => {
    if (!learnerId) return;
    
    setIsSyncing(true);
    
    try {
      const updated = await learnerProfileClient.updateProfileFromEvent(learnerId, event);
      if (updated) {
        setProfile(updated);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update profile');
      setError(error);
      console.error('[useLearnerProfile] Failed to update from event:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [learnerId]);
  
  // Batch update from multiple events
  const batchUpdate = useCallback(async (events: InteractionEvent[]) => {
    if (!learnerId || events.length === 0) return;
    
    setIsSyncing(true);
    
    try {
      const updated = await learnerProfileClient.batchUpdateProfile(learnerId, events);
      if (updated) {
        setProfile(updated);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to batch update profile');
      setError(error);
      console.error('[useLearnerProfile] Failed to batch update:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [learnerId]);
  
  // Sync pending updates now
  const syncNow = useCallback(async (): Promise<boolean> => {
    if (!learnerId) return false;
    
    setIsSyncing(true);
    
    try {
      const success = await learnerProfileClient.syncPendingUpdates(learnerId);
      if (success) {
        // Refresh to get server state
        await refresh();
      }
      return success;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sync');
      setError(error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [learnerId, refresh]);
  
  return {
    profile,
    isLoading,
    isSyncing,
    pendingUpdates,
    error,
    refresh,
    saveProfile,
    updateFromEvent,
    batchUpdate,
    syncNow,
    isOffline,
    hasPendingUpdates,
  };
}

/**
 * Hook for managing all learner profiles (instructor view)
 */
export function useAllLearnerProfiles(): {
  profiles: LearnerProfile[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  totalInteractionCount: number;
  averageConceptCoverage: number;
  profileDistribution: Record<string, number>;
} {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await learnerProfileClient.getAllProfiles();
      setProfiles(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load profiles');
      setError(error);
      console.error('[useAllLearnerProfiles] Failed to load profiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);
  
  // Calculate aggregate stats
  const totalInteractionCount = profiles.reduce(
    (sum, p) => sum + (p.interactionCount || 0), 
    0
  );
  
  const averageConceptCoverage = profiles.length > 0
    ? profiles.reduce((sum, p) => sum + p.conceptsCovered.size, 0) / profiles.length
    : 0;
  
  const profileDistribution = profiles.reduce((acc, p) => {
    const strategy = p.currentStrategy || 'unknown';
    acc[strategy] = (acc[strategy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    profiles,
    isLoading,
    error,
    refresh: loadProfiles,
    totalInteractionCount,
    averageConceptCoverage,
    profileDistribution,
  };
}

export default useLearnerProfile;
