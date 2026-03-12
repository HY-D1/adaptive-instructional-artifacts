/**
 * Formal Policy Definitions
 * 
 * Research-grade escalation policies for experimental comparison.
 * These policies define the complete parameter space for adaptive learning experiments.
 * 
 * Policy Version: policy-definitions-v1
 * 
 * @module policies/policy-definitions
 */

/**
 * Policy trigger configuration
 */
export interface PolicyTriggers {
  /** Time in ms before escalation (stuck detection) */
  timeStuck: number;
  /** Number of hints before rung exhaustion trigger */
  rungExhausted: number;
  /** Number of repeated errors before trigger */
  repeatedError: number;
}

/**
 * Policy threshold configuration
 */
export interface PolicyThresholds {
  /** Errors before escalation to explanation (-1 = disabled) */
  escalate: number;
  /** Errors before aggregation to textbook (-1 = disabled) */
  aggregate: number;
}

/**
 * Formal escalation policy definition
 */
export interface EscalationPolicy {
  /** Unique policy identifier */
  id: 'aggressive' | 'conservative' | 'explanation_first' | 'adaptive' | 'no_hints';
  /** Human-readable name */
  name: string;
  /** Policy description for research documentation */
  description: string;
  /** Escalation and aggregation thresholds */
  thresholds: PolicyThresholds;
  /** Trigger conditions for automatic escalation */
  triggers: PolicyTriggers;
  /** Whether this policy allows hints at all */
  hintsEnabled: boolean;
  /** Whether this policy uses adaptive bandit selection */
  usesBandit: boolean;
}

/**
 * Aggressive Escalation: Fast to explanation, low hint dependency
 * Trades hint exploration for quick problem resolution
 */
export const AGGRESSIVE_POLICY: EscalationPolicy = {
  id: 'aggressive',
  name: 'Aggressive Escalation',
  description: 'Fast to explanation, low hint dependency. Prioritizes quick resolution over exploration.',
  thresholds: { escalate: 1, aggregate: 2 },
  triggers: {
    timeStuck: 60000,      // 1 minute
    rungExhausted: 1,      // After first hint
    repeatedError: 1       // After first error
  },
  hintsEnabled: true,
  usesBandit: false
};

/**
 * Conservative Escalation: Maximize hint exploration before explanation
 * Encourages self-directed learning through extended hint usage
 */
export const CONSERVATIVE_POLICY: EscalationPolicy = {
  id: 'conservative',
  name: 'Conservative Escalation',
  description: 'Maximize hint exploration before explanation. Encourages self-directed discovery.',
  thresholds: { escalate: 3, aggregate: 4 },
  triggers: {
    timeStuck: 300000,     // 5 minutes
    rungExhausted: 3,      // After all 3 hint levels
    repeatedError: 3       // After 3 errors
  },
  hintsEnabled: true,
  usesBandit: false
};

/**
 * Explanation-First: Skip hints, go straight to explanation
 * Control condition for measuring hint effectiveness
 */
export const EXPLANATION_FIRST_POLICY: EscalationPolicy = {
  id: 'explanation_first',
  name: 'Explanation-First',
  description: 'Skip hints, go straight to full explanation. Tests explanation-only learning.',
  thresholds: { escalate: 0, aggregate: 2 },
  triggers: {
    timeStuck: 0,          // Immediate
    rungExhausted: 0,      // No hints
    repeatedError: 0       // Immediate on any error
  },
  hintsEnabled: false,
  usesBandit: false
};

/**
 * Adaptive (Bandit): Bandit-optimized per learner
 * Uses Thompson sampling for dynamic policy selection
 */
export const ADAPTIVE_POLICY: EscalationPolicy = {
  id: 'adaptive',
  name: 'Adaptive (Bandit)',
  description: 'Bandit-optimized per learner using Thompson sampling for dynamic threshold adjustment.',
  thresholds: { escalate: 2, aggregate: 3 },
  triggers: {
    timeStuck: 120000,     // 2 minutes
    rungExhausted: 2,      // After level 2 hint
    repeatedError: 2       // After 2 errors
  },
  hintsEnabled: true,
  usesBandit: true
};

/**
 * No Hints (Control): No assistance provided
 * Baseline for measuring unassisted learning
 */
export const NO_HINTS_POLICY: EscalationPolicy = {
  id: 'no_hints',
  name: 'No Hints (Control)',
  description: 'No assistance provided. Baseline condition for measuring unassisted learning outcomes.',
  thresholds: { escalate: -1, aggregate: -1 },
  triggers: {
    timeStuck: Infinity,
    rungExhausted: Infinity,
    repeatedError: Infinity
  },
  hintsEnabled: false,
  usesBandit: false
};

/**
 * Registry of all escalation policies by ID
 */
export const ESCALATION_POLICIES: Record<string, EscalationPolicy> = {
  'aggressive': AGGRESSIVE_POLICY,
  'conservative': CONSERVATIVE_POLICY,
  'explanation_first': EXPLANATION_FIRST_POLICY,
  'adaptive': ADAPTIVE_POLICY,
  'no_hints': NO_HINTS_POLICY
};

/**
 * List of all policy IDs for iteration
 */
export const POLICY_IDS: EscalationPolicy['id'][] = [
  'aggressive',
  'conservative',
  'explanation_first',
  'adaptive',
  'no_hints'
];

/**
 * Get a policy by its ID
 * 
 * @param id - Policy ID
 * @returns Escalation policy or undefined if not found
 */
export function getPolicyById(id: string): EscalationPolicy | undefined {
  return ESCALATION_POLICIES[id];
}

/**
 * Get all policies that enable hints
 * 
 * @returns Array of hint-enabled policies
 */
export function getHintEnabledPolicies(): EscalationPolicy[] {
  return Object.values(ESCALATION_POLICIES).filter(p => p.hintsEnabled);
}

/**
 * Get all policies for experimental comparison
 * 
 * @returns Array of all policies except control
 */
export function getExperimentalPolicies(): EscalationPolicy[] {
  return Object.values(ESCALATION_POLICIES).filter(p => p.id !== 'no_hints');
}

/**
 * Check if a policy would escalate given error count
 * 
 * @param policyId - Policy ID
 * @param errorCount - Current error count
 * @returns Whether escalation should occur
 */
export function shouldEscalate(policyId: string, errorCount: number): boolean {
  const policy = getPolicyById(policyId);
  if (!policy) return false;
  
  // Disabled escalation
  if (policy.thresholds.escalate < 0) return false;
  
  // Explanation-first escalates immediately (threshold = 0)
  if (policy.thresholds.escalate === 0) return errorCount > 0;
  
  return errorCount >= policy.thresholds.escalate;
}

/**
 * Get the effective escalation threshold for a policy
 * 
 * @param policyId - Policy ID
 * @returns Threshold value or Infinity if disabled
 */
export function getEscalationThreshold(policyId: string): number {
  const policy = getPolicyById(policyId);
  if (!policy) return 3; // Default
  
  return policy.thresholds.escalate < 0 
    ? Infinity 
    : policy.thresholds.escalate;
}

/**
 * Get the policy version for tracking
 * 
 * @returns Version string
 */
export function getPolicyDefinitionsVersion(): string {
  return 'policy-definitions-v1';
}

/**
 * Compare two policies for equivalence
 * Used in testing and validation
 * 
 * @param a - First policy
 * @param b - Second policy
 * @returns True if policies have identical parameters
 */
export function policiesEqual(a: EscalationPolicy, b: EscalationPolicy): boolean {
  return (
    a.id === b.id &&
    a.thresholds.escalate === b.thresholds.escalate &&
    a.thresholds.aggregate === b.thresholds.aggregate &&
    a.triggers.timeStuck === b.triggers.timeStuck &&
    a.triggers.rungExhausted === b.triggers.rungExhausted &&
    a.triggers.repeatedError === b.triggers.repeatedError &&
    a.hintsEnabled === b.hintsEnabled &&
    a.usesBandit === b.usesBandit
  );
}
