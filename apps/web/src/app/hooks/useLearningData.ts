import { useState, useCallback } from 'react';
import { storage } from '../lib/storage';
import type { InteractionEvent, LearnerProfile } from '../types';

/**
 * Return type for useLearningData hook
 */
export interface UseLearningDataReturn {
  /** All interaction events */
  interactions: InteractionEvent[];
  /** All learner profiles */
  profiles: LearnerProfile[];
  /** Loading state */
  isLoading: boolean;
  /** Reload data from storage */
  loadData: () => void;
  /** Set interactions directly */
  setInteractions: (interactions: InteractionEvent[]) => void;
  /** Set profiles directly */
  setProfiles: (profiles: LearnerProfile[]) => void;
  /** Set loading state directly */
  setIsLoading: (isLoading: boolean) => void;
}

/**
 * Custom hook for loading learning data (interactions and profiles)
 * 
 * This hook centralizes the data loading logic that was previously duplicated
 * between ResearchDashboard and InstructorDashboard components.
 * 
 * @example
 * ```typescript
 * const { interactions, profiles, isLoading, loadData } = useLearningData();
 * 
 * useEffect(() => {
 *   loadData();
 * }, []);
 * ```
 */
export function useLearningData(): UseLearningDataReturn {
  const [interactions, setInteractionsState] = useState<InteractionEvent[]>([]);
  const [profiles, setProfilesState] = useState<LearnerProfile[]>([]);
  const [isLoading, setIsLoadingState] = useState(true);

  const loadData = useCallback(() => {
    setInteractionsState(storage.getAllInteractions());
    const loadedProfiles = storage
      .getAllProfiles()
      .map((profile: { id: string }) => storage.getProfile(profile.id))
      .filter((profile): profile is LearnerProfile => Boolean(profile));
    setProfilesState(loadedProfiles);
  }, []);

  const setInteractions = useCallback((newInteractions: InteractionEvent[]) => {
    setInteractionsState(newInteractions);
  }, []);

  const setProfiles = useCallback((newProfiles: LearnerProfile[]) => {
    setProfilesState(newProfiles);
  }, []);

  const setIsLoading = useCallback((loading: boolean) => {
    setIsLoadingState(loading);
  }, []);

  return {
    interactions,
    profiles,
    isLoading,
    loadData,
    setInteractions,
    setProfiles,
    setIsLoading
  };
}

/**
 * Simplified version for just loading profiles
 * Used by InstructorDashboard for basic data loading
 */
export function useLearnerProfiles(): { profiles: LearnerProfile[]; loadProfiles: () => void } {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);

  const loadProfiles = useCallback(() => {
    const loadedProfiles = storage
      .getAllProfiles()
      .map((p: { id: string }) => storage.getProfile(p.id))
      .filter(Boolean) as LearnerProfile[];
    setProfiles(loadedProfiles);
  }, []);

  return { profiles, loadProfiles };
}

/**
 * Hook for loading both profiles and interactions
 * Used by InstructorDashboard
 */
export function useLearnerData(): {
  profiles: LearnerProfile[];
  interactions: InteractionEvent[];
  loadData: () => void;
} {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);

  const loadData = useCallback(() => {
    const loadedProfiles = storage
      .getAllProfiles()
      .map((p: { id: string }) => storage.getProfile(p.id))
      .filter(Boolean) as LearnerProfile[];
    const loadedInteractions = storage.getAllInteractions();
    setProfiles(loadedProfiles);
    setInteractions(loadedInteractions);
  }, []);

  return { profiles, interactions, loadData };
}
