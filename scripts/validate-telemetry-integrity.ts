#!/usr/bin/env node
/**
 * Telemetry Integrity Validation Script
 * 
 * Validates that grading/content fixes preserve research data quality.
 * This script audits telemetry emission paths, correctness semantics,
 * and research export integrity.
 * 
 * Run with: npx tsx scripts/validate-telemetry-integrity.ts
 * 
 * @module scripts/validate-telemetry-integrity
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Type definitions for validation
interface TelemetryEventType {
  name: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  correctnessField?: string;
  researchCritical: boolean;
  dependencies: string[];
}

interface GradingDependency {
  component: string;
  field: string;
  semantics: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
}

interface ValidationResult {
  category: string;
  passed: boolean;
  message: string;
  details?: string[];
}

// TELEMETRY EVENT TYPE REGISTRY
// These are all event types that can be emitted by the system
const TELEMETRY_EVENT_TYPES: TelemetryEventType[] = [
  // Execution events
  {
    name: 'execution',
    description: 'SQL query executed successfully (no errors)',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'successful'],
    optionalFields: ['code', 'conceptIds', 'sessionId', 'timeSpent', 'conditionId'],
    correctnessField: 'successful',
    researchCritical: true,
    dependencies: ['sql-executor.ts', 'SQLEditor.tsx', 'LearningInterface.tsx']
  },
  {
    name: 'error',
    description: 'SQL query execution failed with error',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'error', 'errorSubtypeId'],
    optionalFields: ['code', 'sessionId', 'sqlEngageSubtype', 'policyVersion', 'conditionId'],
    researchCritical: true,
    dependencies: ['sql-executor.ts', 'SQLEditor.tsx', 'LearningInterface.tsx']
  },

  // Help/ladder events
  {
    name: 'hint_view',
    description: 'Learner viewed a hint at specific level',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'hintLevel', 'hintText', 'templateId'],
    optionalFields: ['hintId', 'sqlEngageSubtype', 'sqlEngageRowId', 'helpRequestIndex', 'policyVersion', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx', 'guidance-ladder.ts']
  },
  {
    name: 'explanation_view',
    description: 'Learner viewed an explanation (escalation)',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'explanationId'],
    optionalFields: ['helpRequestIndex', 'sqlEngageSubtype', 'escalationTriggerReason', 'errorCountAtEscalation', 'timeToEscalation', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx', 'guidance-ladder.ts']
  },
  {
    name: 'guidance_request',
    description: 'Learner requested help (L1 hint, L2 explanation, or L3 textbook)',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'requestType', 'currentRung'],
    optionalFields: ['sessionId', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx']
  },
  {
    name: 'guidance_escalate',
    description: 'System escalated to higher rung',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'fromRung', 'toRung', 'trigger'],
    optionalFields: ['evidence', 'sourceInteractionIds', 'sessionId', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx', 'guidance-ladder.ts']
  },
  {
    name: 'guidance_view',
    description: 'Learner viewed guidance at specific rung',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'rung'],
    optionalFields: ['conceptIds', 'grounded', 'sourceRefIds', 'contentLength', 'sessionId', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx']
  },

  // Content/textbook events
  {
    name: 'textbook_add',
    description: 'Content added to learner textbook',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'noteId', 'noteContent'],
    optionalFields: ['templateId', 'policyVersion', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx', 'content-generator.ts']
  },
  {
    name: 'textbook_update',
    description: 'Content updated in learner textbook',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'noteId', 'noteContent'],
    optionalFields: ['templateId', 'policyVersion', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx']
  },
  {
    name: 'textbook_unit_upsert',
    description: 'Instructional unit created or updated',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'unitId', 'action'],
    optionalFields: ['dedupeKey', 'revisionCount', 'sessionId', 'conditionId'],
    researchCritical: true,
    dependencies: ['textbook-units.ts']
  },

  // Concept events
  {
    name: 'concept_view',
    description: 'Learner viewed concept material',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'conceptId', 'source'],
    optionalFields: ['conceptIds', 'unitId', 'sessionId', 'conditionId'],
    researchCritical: true,
    dependencies: ['storage.ts', 'telemetry-contract.test.ts']
  },
  {
    name: 'coverage_change',
    description: 'Concept coverage score changed',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'conceptIds'],
    optionalFields: ['inputs', 'outputs', 'sessionId', 'conditionId'],
    researchCritical: true,
    dependencies: ['storage.ts', 'mastery-engine.ts']
  },

  // Session events
  {
    name: 'session_end',
    description: 'Learning session ended',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'sessionId', 'totalTime', 'problemsAttempted', 'problemsSolved'],
    optionalFields: ['conditionId'],
    researchCritical: true,
    dependencies: ['LearningInterface.tsx']
  },
  {
    name: 'code_change',
    description: 'Learner modified SQL code',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'code'],
    optionalFields: ['timeSpent', 'sessionId', 'conditionId'],
    researchCritical: false,
    dependencies: ['useDebouncedCodeChange.ts']
  },

  // Profile/assignment events
  {
    name: 'profile_assigned',
    description: 'Escalation profile assigned to learner',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'profileId', 'assignmentStrategy'],
    optionalFields: ['conditionId'],
    researchCritical: true,
    dependencies: ['escalation-profiles.ts', 'condition-assignment.ts']
  },
  {
    name: 'escalation_triggered',
    description: 'Profile escalation triggered',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'profileId', 'errorCountAtEscalation'],
    optionalFields: ['timeToEscalation', 'escalationTriggerReason', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx']
  },
  {
    name: 'condition_assigned',
    description: 'Experimental condition assigned',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'conditionId', 'escalationPolicy'],
    optionalFields: ['textbookDisabled', 'adaptiveLadderDisabled', 'immediateExplanationMode', 'staticHintMode'],
    researchCritical: true,
    dependencies: ['condition-assignment.ts']
  },

  // Bandit/ML events
  {
    name: 'bandit_arm_selected',
    description: 'Multi-armed bandit selected an arm',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'selectedArm', 'selectionMethod'],
    optionalFields: ['armStatsAtSelection', 'conditionId'],
    researchCritical: true,
    dependencies: ['learner-bandit-manager.ts']
  },
  {
    name: 'bandit_reward_observed',
    description: 'Reward observed for bandit arm',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'selectedArm', 'reward'],
    optionalFields: ['rewardValue', 'conditionId'],
    researchCritical: true,
    dependencies: ['learner-bandit-manager.ts']
  },
  {
    name: 'bandit_updated',
    description: 'Bandit arm statistics updated',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'selectedArm', 'newAlpha', 'newBeta'],
    optionalFields: ['conditionId'],
    researchCritical: true,
    dependencies: ['learner-bandit-manager.ts']
  },

  // HDI events
  {
    name: 'hdi_calculated',
    description: 'Help Dependency Index calculated',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'hdi', 'hdiLevel'],
    optionalFields: ['hdiComponents', 'conditionId'],
    researchCritical: true,
    dependencies: ['hdi-calculator.ts']
  },
  {
    name: 'hdi_trajectory_updated',
    description: 'HDI trend trajectory updated',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'hdi', 'trend'],
    optionalFields: ['slope', 'conditionId'],
    researchCritical: true,
    dependencies: ['hdi-calculator.ts']
  },
  {
    name: 'dependency_intervention_triggered',
    description: 'Intervention triggered by high HDI',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'hdi', 'interventionType'],
    optionalFields: ['conditionId'],
    researchCritical: true,
    dependencies: ['hdi-calculator.ts']
  },

  // Knowledge structure events
  {
    name: 'prerequisite_violation_detected',
    description: 'Prerequisite violation detected',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId'],
    optionalFields: ['violationType', 'missingPrerequisites', 'severity', 'conditionId'],
    researchCritical: true,
    dependencies: ['prerequisite-detector.ts']
  },
  {
    name: 'mastery_updated',
    description: 'Concept mastery level updated',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'conceptIds'],
    optionalFields: ['masteryLevel', 'previousLevel', 'conditionId'],
    researchCritical: true,
    dependencies: ['mastery-engine.ts']
  },
  {
    name: 'reflection_quality_assessed',
    description: 'Self-explanation quality assessed',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId'],
    optionalFields: ['qualityScore', 'feedback', 'conditionId'],
    researchCritical: true,
    dependencies: ['reflection-scorer.ts']
  },

  // Reinforcement events
  {
    name: 'reinforcement_scheduled',
    description: 'Reinforcement prompt scheduled',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'scheduleId', 'unitId'],
    optionalFields: ['delayDays', 'conditionId'],
    researchCritical: true,
    dependencies: ['reinforcement-manager.ts']
  },
  {
    name: 'reinforcement_prompt_shown',
    description: 'Reinforcement prompt displayed',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'promptId', 'promptType'],
    optionalFields: ['sourceUnitId', 'delayBucket', 'conditionId'],
    researchCritical: true,
    dependencies: ['reinforcement-manager.ts']
  },
  {
    name: 'reinforcement_response',
    description: 'Learner responded to reinforcement',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'promptId', 'isCorrect'],
    optionalFields: ['response', 'reinforcementLatencyMs', 'delayBucket', 'conditionId'],
    correctnessField: 'isCorrect',
    researchCritical: true,
    dependencies: ['reinforcement-manager.ts', 'textbook-orchestrator.ts']
  },

  // Feedback events
  {
    name: 'hint_helpfulness_rating',
    description: 'Learner rated hint helpfulness',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'hintIndex', 'helpfulnessRating'],
    optionalFields: ['rung', 'conditionId'],
    researchCritical: true,
    dependencies: ['HintSystem.tsx']
  },

  // Chat events
  {
    name: 'chat_interaction',
    description: 'Ask My Textbook chat interaction',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'chatMessage', 'chatResponse'],
    optionalFields: ['textbookUnitsRetrieved', 'savedToNotes', 'conditionId'],
    researchCritical: true,
    dependencies: ['AskMyTextbookChat.tsx']
  },

  // LLM events
  {
    name: 'llm_generate',
    description: 'LLM generation performed',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId', 'model'],
    optionalFields: ['inputHash', 'templateId', 'executionTimeMs', 'llmProvider', 'llmModel', 'llmLatencyMs', 'conditionId'],
    researchCritical: false,
    dependencies: ['content-generator.ts', 'llm-client.ts']
  },
  {
    name: 'concept_extraction',
    description: 'Background concept extraction completed',
    requiredFields: ['id', 'learnerId', 'timestamp', 'eventType', 'problemId'],
    optionalFields: ['extractedConcepts', 'conditionId'],
    researchCritical: false,
    dependencies: ['trace-analyzer.ts']
  },
];

// GRADING DEPENDENCIES - Critical correctness semantics
const GRADING_DEPENDENCIES: GradingDependency[] = [
  {
    component: 'LearningInterface.tsx',
    field: 'successful',
    semantics: 'Reflects semantic correctness (result matching), not just execution success. Set via: const actuallyCorrect = isCorrect ?? result.success; where isCorrect comes from compareResults()',
    impact: 'critical'
  },
  {
    component: 'SQLEditor.tsx',
    field: 'isCorrect (passed to onExecute)',
    semantics: 'Calculated via compareResults(actual, expected).match - true if query results match expected results using epsilon-aware comparison',
    impact: 'critical'
  },
  {
    component: 'sql-executor.ts',
    field: 'compareResults().match',
    semantics: 'Set-based comparison with epsilon tolerance (0.01) for floats, exact for integers. Row order ignored, column order ignored.',
    impact: 'critical'
  },
  {
    component: 'sql-executor.ts',
    field: 'executeQuery().success',
    semantics: 'Technical execution success (no SQL errors). DIFFERENT from correctness - a query can succeed but be wrong.',
    impact: 'high'
  },
  {
    component: 'sql-executor.ts',
    field: 'errorSubtypeId',
    semantics: 'Normalized error subtype from normalizeSqlErrorSubtype(). Used for hint targeting and error analysis.',
    impact: 'high'
  },
  {
    component: 'guidance-ladder.ts',
    field: 'time_stuck trigger',
    semantics: 'Checks for successful executions: problemInteractions.filter(i => i.eventType === "execution" && i.successful)',
    impact: 'high'
  },
  {
    component: 'learner-profile-client.ts',
    field: 'solvedProblemIds',
    semantics: 'Added when event.eventType === "execution" && event.successful && event.problemId',
    impact: 'critical'
  },
  {
    component: 'neon.ts (backend)',
    field: 'problem_progress.solved',
    semantics: 'Updated when event.eventType === "execution" && event.successful && event.problemId',
    impact: 'critical'
  },
  {
    component: 'mastery-engine.ts',
    field: 'mastery updates',
    semantics: 'Successful executions trigger mastery propagation through concept graph',
    impact: 'high'
  },
  {
    component: 'banditManager',
    field: 'recordOutcome()',
    semantics: 'Called when problem solved (successful execution). Calculates reward based on errorCount, usedExplanation, timeSpent.',
    impact: 'high'
  },
  {
    component: 'HDI Calculator',
    field: 'hdi score',
    semantics: 'Uses execution events to calculate HPA (Hints Per Attempt) and IWH (Improvement Without Hint)',
    impact: 'medium'
  },
  {
    component: 'Research Dashboard',
    field: 'problemsSolved',
    semantics: 'Filtered from session_end events: interaction.eventType === "execution" && interaction.successful',
    impact: 'critical'
  },
];

// HINT ESCALATION DEPENDENCIES
const HINT_ESCALATION_DEPENDENCIES = [
  {
    trigger: 'rung_exhausted',
    dependsOn: ['hint_view event count per problem'],
    description: 'After N hints at current rung, escalate. N varies by profile (2-5).'
  },
  {
    trigger: 'repeated_error',
    dependsOn: ['error event count', 'errorSubtypeId matching'],
    description: 'Same error subtype appearing 2+ times in last 3 attempts'
  },
  {
    trigger: 'time_stuck',
    dependsOn: ['execution events with successful=true', 'firstInteraction.timestamp'],
    description: 'No successful execution for 5 minutes after first interaction'
  },
  {
    trigger: 'learner_request',
    dependsOn: ['explanation_view events', 'manual escalation button'],
    description: 'User explicitly clicked "Get More Help" or "Explain"'
  },
  {
    trigger: 'auto_escalation_eligible',
    dependsOn: ['errorSubtypeId', 'alignment map verification'],
    description: 'Error subtype is verified for auto-escalation in alignment map'
  },
];

// CORRECTNESS FIELD SEMANTICS
const CORRECTNESS_SEMANTICS = {
  'execution.successful': {
    true: 'Query executed AND results match expected (for result-graded problems) OR query executed without errors (for exec-only problems)',
    false: 'Query failed to execute OR results do not match expected (result-graded)',
    derivedFrom: 'isCorrect ?? result.success where isCorrect = compareResults().match',
    researchImpact: 'Used for: mastery updates, solved status, bandit rewards, session_end metrics, problem_progress.solved'
  },
  'execution.eventType': {
    execution: 'No SQL errors occurred during execution (may still be incorrect results)',
    error: 'SQL error occurred (syntax, semantic, or runtime error)',
    researchImpact: 'Used for: error rate calculations, error pattern analysis'
  },
  'reinforcement_response.isCorrect': {
    true: 'Learner answered reinforcement prompt correctly',
    false: 'Learner answered incorrectly or skipped',
    researchImpact: 'Used for: delayed retention analysis, knowledge consolidation metrics'
  },
  'error.errorSubtypeId': {
    description: 'Normalized error category from SQL-Engage taxonomy',
    examples: ['syntax_error', 'missing_from_clause', 'ambiguous_column', 'type_mismatch'],
    researchImpact: 'Used for: hint targeting, error pattern analysis, concept struggle detection'
  }
};

// MAIN VALIDATION FUNCTIONS

function log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
  };
  console.log(`${colorMap[level]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function validateEventTypes(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Check for unique event type names
  const names = TELEMETRY_EVENT_TYPES.map(e => e.name);
  const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
  
  if (duplicates.length > 0) {
    results.push({
      category: 'Event Type Uniqueness',
      passed: false,
      message: `Duplicate event types found: ${duplicates.join(', ')}`,
    });
  } else {
    results.push({
      category: 'Event Type Uniqueness',
      passed: true,
      message: `All ${names.length} event types are unique`,
    });
  }

  // Check for required fields
  const missingFields = TELEMETRY_EVENT_TYPES.filter(e => 
    !e.requiredFields.includes('id') || 
    !e.requiredFields.includes('learnerId') || 
    !e.requiredFields.includes('timestamp') ||
    !e.requiredFields.includes('eventType') ||
    !e.requiredFields.includes('problemId')
  );

  if (missingFields.length > 0) {
    results.push({
      category: 'Required Fields',
      passed: false,
      message: `${missingFields.length} event types missing required base fields`,
      details: missingFields.map(e => e.name)
    });
  } else {
    results.push({
      category: 'Required Fields',
      passed: true,
      message: 'All event types have required base fields (id, learnerId, timestamp, eventType, problemId)',
    });
  }

  // Check correctness fields
  const correctnessEvents = TELEMETRY_EVENT_TYPES.filter(e => e.correctnessField);
  results.push({
    category: 'Correctness Fields',
    passed: true,
    message: `${correctnessEvents.length} event types have explicit correctness semantics`,
    details: correctnessEvents.map(e => `${e.name}.${e.correctnessField}`)
  });

  return results;
}

function validateGradingDependencies(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Critical dependencies check
  const criticalDeps = GRADING_DEPENDENCIES.filter(d => d.impact === 'critical');
  results.push({
    category: 'Critical Dependencies',
    passed: true,
    message: `${criticalDeps.length} critical grading dependencies identified`,
    details: criticalDeps.map(d => `${d.component}:${d.field} (${d.semantics.slice(0, 50)}...)`)
  });

  // Check for correctness field consistency
  const executionCorrectness = GRADING_DEPENDENCIES.find(d => 
    d.component === 'LearningInterface.tsx' && d.field === 'successful'
  );
  
  if (executionCorrectness) {
    results.push({
      category: 'Correctness Semantics',
      passed: true,
      message: 'execution.successful has clear semantics: reflects semantic correctness',
      details: [executionCorrectness.semantics]
    });
  }

  // Check compareResults dependency chain
  const compareResultsChain = [
    GRADING_DEPENDENCIES.find(d => d.component === 'sql-executor.ts' && d.field === 'compareResults().match'),
    GRADING_DEPENDENCIES.find(d => d.component === 'SQLEditor.tsx' && d.field === 'isCorrect (passed to onExecute)'),
    GRADING_DEPENDENCIES.find(d => d.component === 'LearningInterface.tsx' && d.field === 'successful'),
  ];

  if (compareResultsChain.every(d => d)) {
    results.push({
      category: 'Correctness Chain',
      passed: true,
      message: 'Correctness propagation chain is intact: compareResults -> SQLEditor -> LearningInterface -> telemetry',
    });
  } else {
    results.push({
      category: 'Correctness Chain',
      passed: false,
      message: 'Correctness propagation chain may be broken',
    });
  }

  return results;
}

function validateHintEscalation(): ValidationResult[] {
  const results: ValidationResult[] = [];

  results.push({
    category: 'Escalation Triggers',
    passed: true,
    message: `${HINT_ESCALATION_DEPENDENCIES.length} escalation triggers documented`,
    details: HINT_ESCALATION_DEPENDENCIES.map(t => `${t.trigger}: depends on ${t.dependsOn.join(', ')}`)
  });

  // Check time_stuck depends on successful execution
  const timeStuck = HINT_ESCALATION_DEPENDENCIES.find(t => t.trigger === 'time_stuck');
  if (timeStuck && timeStuck.dependsOn.some(d => d.includes('successful'))) {
    results.push({
      category: 'time_stuck Trigger',
      passed: true,
      message: 'time_stuck escalation correctly depends on successful executions',
    });
  }

  return results;
}

function generateResearchIntegrityReport(): string {
  const lines: string[] = [];
  
  lines.push('# Telemetry Integrity Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('This report documents the telemetry emission paths and correctness semantics');
  lines.push('to ensure grading/content fixes preserve research data quality.');
  lines.push('');
  
  lines.push('## Event Types');
  lines.push('');
  lines.push(`Total event types: ${TELEMETRY_EVENT_TYPES.length}`);
  lines.push(`Research-critical events: ${TELEMETRY_EVENT_TYPES.filter(e => e.researchCritical).length}`);
  lines.push('');
  
  for (const event of TELEMETRY_EVENT_TYPES) {
    lines.push(`### ${event.name}`);
    lines.push(`- Description: ${event.description}`);
    lines.push(`- Research Critical: ${event.researchCritical ? 'YES' : 'No'}`);
    lines.push(`- Required Fields: ${event.requiredFields.join(', ')}`);
    if (event.correctnessField) {
      lines.push(`- Correctness Field: ${event.correctnessField}`);
    }
    lines.push(`- Dependencies: ${event.dependencies.join(', ')}`);
    lines.push('');
  }
  
  lines.push('## Correctness Semantics');
  lines.push('');
  for (const [field, semantics] of Object.entries(CORRECTNESS_SEMANTICS)) {
    lines.push(`### ${field}`);
    for (const [key, value] of Object.entries(semantics)) {
      lines.push(`- ${key}: ${value}`);
    }
    lines.push('');
  }
  
  lines.push('## Grading Dependencies');
  lines.push('');
  for (const dep of GRADING_DEPENDENCIES) {
    lines.push(`### ${dep.component} - ${dep.field}`);
    lines.push(`- Impact: ${dep.impact.toUpperCase()}`);
    lines.push(`- Semantics: ${dep.semantics}`);
    lines.push('');
  }
  
  lines.push('## Hint Escalation Dependencies');
  lines.push('');
  for (const trigger of HINT_ESCALATION_DEPENDENCIES) {
    lines.push(`### ${trigger.trigger}`);
    lines.push(`- Description: ${trigger.description}`);
    lines.push(`- Depends on: ${trigger.dependsOn.join(', ')}`);
    lines.push('');
  }
  
  lines.push('## Risks and Concerns');
  lines.push('');
  lines.push('### High Risk');
  lines.push('1. **execution.successful semantics change**: If the meaning of `successful` changes');
  lines.push('   from "result matches expected" to just "executed without errors", research');
  lines.push('   analytics about problem solving accuracy will be broken.');
  lines.push('');
  lines.push('2. **compareResults() changes**: Modifications to epsilon tolerance, row ordering,');
  lines.push('   or comparison logic will affect correctness determination.');
  lines.push('');
  lines.push('### Medium Risk');
  lines.push('1. **errorSubtypeId normalization**: Changes to error classification taxonomy');
  lines.push('   will break error pattern analysis and hint targeting.');
  lines.push('');
  lines.push('2. **time_spent calculation**: Changes to how time is measured will affect');
  lines.push('   efficiency analytics and time_stuck trigger behavior.');
  lines.push('');
  
  lines.push('## Validation Checklist');
  lines.push('');
  lines.push('- [ ] execution.successful reflects semantic correctness');
  lines.push('- [ ] compareResults() uses epsilon-aware float comparison');
  lines.push('- [ ] errorSubtypeId uses normalized SQL-Engage taxonomy');
  lines.push('- [ ] hint escalation triggers depend on correct events');
  lines.push('- [ ] Research export includes all required fields');
  lines.push('- [ ] Session end metrics accurately count solved problems');
  lines.push('');
  
  return lines.join('\n');
}

async function runValidations() {
  console.log(`${colors.bright}${colors.magenta}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     TELEMETRY INTEGRITY VALIDATION                           ║');
  console.log('║     Grading/Content Fix Research Impact Assessment          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  // Event type validation
  logSection('1. TELEMETRY EVENT TYPES');
  const eventResults = validateEventTypes();
  for (const result of eventResults) {
    log(`${result.passed ? '✓' : '✗'} ${result.category}: ${result.message}`, result.passed ? 'success' : 'error');
    if (result.details) {
      for (const detail of result.details.slice(0, 5)) {
        console.log(`    ${colors.dim}${detail}${colors.reset}`);
      }
      if (result.details.length > 5) {
        console.log(`    ${colors.dim}... and ${result.details.length - 5} more${colors.reset}`);
      }
    }
  }

  // Grading dependencies validation
  logSection('2. GRADING DEPENDENCIES');
  const gradingResults = validateGradingDependencies();
  for (const result of gradingResults) {
    log(`${result.passed ? '✓' : '✗'} ${result.category}: ${result.message}`, result.passed ? 'success' : 'error');
    if (result.details) {
      for (const detail of result.details.slice(0, 3)) {
        console.log(`    ${colors.dim}${detail}${colors.reset}`);
      }
    }
  }

  // Hint escalation validation
  logSection('3. HINT ESCALATION DEPENDENCIES');
  const escalationResults = validateHintEscalation();
  for (const result of escalationResults) {
    log(`${result.passed ? '✓' : '✗'} ${result.category}: ${result.message}`, result.passed ? 'success' : 'error');
  }

  // Generate report
  logSection('4. GENERATING REPORT');
  const report = generateResearchIntegrityReport();
  const reportPath = path.join(process.cwd(), 'docs', 'audit', 'telemetry-integrity-report.md');
  
  // Ensure directory exists
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, report);
  log(`Report saved to: ${reportPath}`, 'success');

  // Summary
  logSection('SUMMARY');
  const allResults = [...eventResults, ...gradingResults, ...escalationResults];
  const passedCount = allResults.filter(r => r.passed).length;
  const totalCount = allResults.length;
  
  log(`Total Checks: ${totalCount}`, 'info');
  log(`Passed: ${passedCount}`, 'success');
  log(`Failed: ${totalCount - passedCount}`, totalCount - passedCount > 0 ? 'error' : 'success');
  
  // Risk summary
  log('\n' + colors.bright + 'KEY RESEARCH INTEGRITY PRESERVATION POINTS:' + colors.reset);
  log('1. execution.successful MUST reflect semantic correctness (not just execution)', 'warning');
  log('2. compareResults() MUST maintain epsilon-aware float comparison', 'warning');
  log('3. errorSubtypeId MUST use consistent SQL-Engage taxonomy', 'warning');
  log('4. Hint escalation MUST depend on actual successful executions', 'warning');
  log('5. Problems solved count MUST come from execution.successful=true events', 'warning');
  
  return totalCount - passedCount === 0;
}

// Run validations
runValidations()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
