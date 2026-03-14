/**
 * Knowledge-Structure Adaptive Features
 * 
 * Exports all knowledge-structure modules for adaptive learning:
 * - Prerequisite Monitor: Detects and warns about prerequisite violations
 * - Learning Path: Calculates and recommends optimal learning paths
 * - Mastery Engine: Tracks and propagates concept mastery
 * - Reflection Scorer: Assesses reflection quality on RQS scale
 */

// Prerequisite Monitor
export {
  checkProblemReadiness,
  monitorForViolation,
  logViolationEvent,
  getViolationSummary,
  clearViolationCache,
  type PrerequisiteViolation,
  type ViolationSummary,
  type PrerequisiteCheckResult
} from './prerequisite-monitor';

// Learning Path
export {
  buildLearningPath,
  updatePathAfterSuccess,
  getNextRecommendedConcept,
  getConceptProgress,
  isConceptBlocked,
  getShortestPath,
  getPathStrategies,
  type LearningPathRecommendation,
  type PathProgress,
  type PathStrategy
} from './learning-path';

// Mastery Engine
export {
  getMasteryLevel,
  getConceptMastery,
  getMasterySnapshot,
  updateMasteryFromInteraction,
  propagateMastery,
  applyMasteryDecay,
  getConceptsNeedingReview,
  getMasteryStats,
  type MasteryLevel,
  type ConceptMastery,
  type MasteryUpdate,
  type MasteryPropagationResult,
  type MasterySnapshot
} from './mastery-engine';

// Reflection Scorer
export {
  scoreReflection,
  assessReflection,
  getReflectionBasedAdaptation,
  getReflectionHistory,
  getReflectionStats,
  meetsMinimumQuality,
  getRQSDescription,
  type RQSLevel,
  type ReflectionScore,
  type ReflectionAssessment
} from './reflection-scorer';

// Re-export from prerequisite-checker for convenience
export {
  checkPrerequisites,
  checkPrerequisitesBatch,
  getRecommendedNextConcepts,
  getPrerequisiteChain,
  getNewlyUnlockedConcepts,
  getPathToConcept,
  validateConceptGraph,
  type PrerequisiteStatus
} from '../content/prerequisite-checker';

// Re-export from prerequisite-detector
export {
  detectPrerequisiteViolation,
  detectViolationsBatch,
  logPrerequisiteViolation,
  previewViolation,
  getLearnerViolations,
  clearViolationHistory,
  type PrerequisiteViolation as DetectorViolation
} from '../content/prerequisite-detector';

// Re-export from mastery-propagation
export {
  propagateMastery as propagateMasteryLegacy,
  getConceptMastery as getLegacyConceptMastery,
  getMasteryDepth,
  getReadinessScore,
  getMasteryRecommendations,
  getMasteryStats as getLegacyMasteryStats,
  type MasteryPropagation,
  type MasteryPropagationResult as LegacyPropagationResult
} from '../content/mastery-propagation';

// Re-export from self-explanation-scorer
export {
  scoreSelfExplanation,
  meetsMinimumQuality as meetsMinQuality,
  getQualityLevel,
  type SelfExplanationInput,
  type ReflectionQualityScore
} from '../content/self-explanation-scorer';
