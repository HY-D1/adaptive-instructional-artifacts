// Research Analysis Modules
export { 
  clusterLearners, 
  getLearnerClusterInfo,
  type LearnerCluster, 
  type LearnerFeatures 
} from './learner-clustering';

export { 
  buildErrorTransitionMatrix,
  buildErrorTransitionStats,
  getErrorRecoveryPatterns,
  getErrorsBeforeHints,
  type ErrorTransitionMatrix,
  type ErrorTransitionStats,
  type ErrorChain
} from './error-transitions';
