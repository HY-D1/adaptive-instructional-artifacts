/**
 * Hooks Index
 * 
 * Barrel file that exports all custom React hooks for the application.
 * Centralizes hook imports to maintain clean import paths.
 * 
 * @module hooks
 */

export { useUserRole } from './useUserRole';
export { 
  useSessionPersistence, 
  useActivityTracker, 
  useSaveProfile, 
  useClearProfile 
} from './useSessionPersistence';
export { useLearningData, useLearnerProfiles, useLearnerData } from './useLearningData';
