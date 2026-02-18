#!/usr/bin/env node
/**
 * Replay Metrics Script (Week 3 D9)
 * 
 * Computes summary metrics from exported session data for offline analysis.
 * Provides insights into guidance effectiveness, escalation patterns, and
 * learning outcomes.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Detects export format type
 * @param {Object} exportData - The exported session data
 * @returns {string} Format type: 'session', 'replay', or 'unknown'
 */
function detectExportFormat(exportData) {
  if (exportData.interactions && Array.isArray(exportData.interactions)) {
    return 'session';
  }
  if (exportData.policy_results && Array.isArray(exportData.policy_results)) {
    return 'replay';
  }
  return 'unknown';
}

/**
 * Normalizes replay format to session format
 * @param {Object} replayData - The replay export data
 * @returns {Object} Normalized data
 */
function normalizeReplayFormat(replayData) {
  // Combine all policy decisions into interactions-like array
  const allDecisions = [];
  for (const policy of replayData.policy_results || []) {
    for (const decision of policy.decisions || []) {
      allDecisions.push({
        ...decision,
        policy_id: policy.policy_id,
        policy_strategy: policy.strategy
      });
    }
  }
  
  return {
    interactions: allDecisions.map(d => ({
      id: d.event_id,
      eventType: mapDecisionToEventType(d.outputs?.action),
      problemId: d.problem_id,
      learnerId: d.learner_id,
      timestamp: d.timestamp,
      hintLevel: d.outputs?.hint_level,
      ruleFired: d.rule_fired,
      retrievedSourceIds: d.retrieved_source_ids || []
    })),
    profiles: [],
    textbooks: {}
  };
}

/**
 * Map replay decision action to event type
 */
function mapDecisionToEventType(action) {
  switch (action) {
    case 'show_hint': return 'hint_view';
    case 'show_explanation': return 'explanation_view';
    case 'add_to_textbook': return 'textbook_add';
    case 'no_intervention': return 'execution';
    default: return 'unknown';
  }
}

/**
 * Computes all metrics from export data
 * @param {Object} exportData - The exported session data
 * @returns {Object} Computed metrics
 */
export function computeMetrics(exportData) {
  const format = detectExportFormat(exportData);
  
  let interactions, profiles, textbooks;
  
  if (format === 'session') {
    interactions = exportData.interactions || [];
    profiles = exportData.profiles || [];
    textbooks = exportData.textbooks || {};
  } else if (format === 'replay') {
    const normalized = normalizeReplayFormat(exportData);
    interactions = normalized.interactions;
    profiles = normalized.profiles;
    textbooks = normalized.textbooks;
  } else {
    // Unknown format - try to use whatever fields are available
    interactions = exportData.interactions || [];
    profiles = exportData.profiles || [];
    textbooks = exportData.textbooks || {};
  }

  return {
    summary: computeSummary(interactions),
    rungDistribution: computeRungDistribution(interactions),
    escalationReasons: computeEscalationReasons(interactions),
    timeToEscalation: computeTimeToEscalation(interactions),
    textbookGrowth: computeTextbookGrowth(textbooks, interactions),
    groundednessRate: computeGroundednessRate(interactions)
  };
}

/**
 * Compute summary statistics
 */
function computeSummary(interactions) {
  const guidanceEvents = interactions.filter(i => 
    i.eventType === 'hint_view' || 
    i.eventType === 'explanation_view' ||
    i.eventType === 'textbook_add' ||
    i.eventType === 'textbook_update'
  );

  // Count escalations (explanation_view events that follow hint exhaustion)
  const escalations = interactions.filter(i => 
    i.eventType === 'explanation_view' && 
    (i.ruleFired === 'escalation' || 
     i.ruleFired === 'auto-escalation-after-hints' ||
     i.ruleFired?.includes('escalation'))
  );

  return {
    totalInteractions: interactions.length,
    totalGuidanceEvents: guidanceEvents.length,
    totalEscalations: escalations.length
  };
}

/**
 * Compute distribution of hint levels (rungs 1, 2, 3)
 */
function computeRungDistribution(interactions) {
  const hintViews = interactions.filter(i => i.eventType === 'hint_view');
  
  const counts = { 1: 0, 2: 0, 3: 0 };
  
  for (const hint of hintViews) {
    const level = hint.hintLevel || hint.outputs?.hint_level || 1;
    if (level >= 1 && level <= 3) {
      counts[level]++;
    }
  }

  const total = counts[1] + counts[2] + counts[3];
  
  if (total === 0) {
    return {
      1: { count: 0, percentage: 0 },
      2: { count: 0, percentage: 0 },
      3: { count: 0, percentage: 0 }
    };
  }

  return {
    1: { count: counts[1], percentage: round((counts[1] / total) * 100) },
    2: { count: counts[2], percentage: round((counts[2] / total) * 100) },
    3: { count: counts[3], percentage: round((counts[3] / total) * 100) }
  };
}

/**
 * Compute escalation trigger breakdown
 */
function computeEscalationReasons(interactions) {
  const reasons = {
    learner_request: 0,
    rung_exhausted: 0,
    repeated_error: 0,
    time_stuck: 0,
    hint_reopened: 0,
    auto_escalation_eligible: 0
  };

  // Analyze explanation_view events to determine escalation triggers
  const explanationViews = interactions.filter(i => i.eventType === 'explanation_view');
  
  for (const explanation of explanationViews) {
    const ruleFired = explanation.ruleFired || explanation.outputs?.rule_fired || '';
    const inputs = explanation.inputs || {};
    const hintCount = inputs.hint_count ?? inputs.hintCount ?? 0;
    
    // Map ruleFired to escalation reason
    if (ruleFired === 'auto-escalation-after-hints' || 
        ruleFired === 'auto-escalation-eligible' ||
        explanation.metadata?.escalationRequested) {
      reasons.auto_escalation_eligible++;
    } else if (ruleFired === 'escalation-threshold-met' || 
               ruleFired === 'escalation' ||
               hintCount >= 3) {
      // If hints exhausted (level 3 was shown), it's rung_exhausted
      reasons.rung_exhausted++;
    } else if (ruleFired === 'learner-request' || 
               ruleFired === 'learner_request' ||
               (explanation.helpRequestIndex && explanation.helpRequestIndex > 1)) {
      reasons.learner_request++;
    } else if (ruleFired === 'repeated-error' || ruleFired === 'repeated_error') {
      reasons.repeated_error++;
    } else if (ruleFired === 'time-stuck' || ruleFired === 'time_stuck') {
      reasons.time_stuck++;
    } else if (ruleFired === 'hint-reopened' || ruleFired === 'hint_reopened') {
      reasons.hint_reopened++;
    } else {
      // Default classification based on context
      if (hintCount >= 3) {
        reasons.rung_exhausted++;
      } else {
        reasons.learner_request++;
      }
    }
  }

  return reasons;
}

/**
 * Compute time and attempt metrics leading to escalation
 */
function computeTimeToEscalation(interactions) {
  // Group interactions by problem
  const problemInteractions = groupByProblem(interactions);
  
  let totalErrorsBeforeEscalation = 0;
  let totalTimeBeforeEscalation = 0;
  let totalHintsBeforeEscalation = 0;
  let escalationCount = 0;

  for (const [problemId, events] of Object.entries(problemInteractions)) {
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
    
    // Find escalation events (explanation_view)
    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      if (event.eventType === 'explanation_view') {
        // Count errors before this escalation
        const errorsBefore = sortedEvents
          .slice(0, i)
          .filter(e => e.eventType === 'error').length;
        
        // Count hints before this escalation
        const hintsBefore = sortedEvents
          .slice(0, i)
          .filter(e => e.eventType === 'hint_view').length;
        
        // Calculate time spent before escalation
        const firstInteraction = sortedEvents[0];
        const timeBefore = event.timestamp - (firstInteraction?.timestamp || event.timestamp);
        
        totalErrorsBeforeEscalation += errorsBefore;
        totalHintsBeforeEscalation += hintsBefore;
        totalTimeBeforeEscalation += timeBefore;
        escalationCount++;
      }
    }
  }

  if (escalationCount === 0) {
    return {
      averageErrorsBefore: 0,
      averageTimeMs: 0,
      averageHintsBefore: 0
    };
  }

  return {
    averageErrorsBefore: round(totalErrorsBeforeEscalation / escalationCount, 1),
    averageTimeMs: Math.round(totalTimeBeforeEscalation / escalationCount),
    averageHintsBefore: round(totalHintsBeforeEscalation / escalationCount, 1)
  };
}

/**
 * Compute textbook growth metrics
 */
function computeTextbookGrowth(textbooks, interactions) {
  let unitsCreated = 0;
  let unitsUpdated = 0;
  const uniqueConcepts = new Set();

  // Count from interactions
  for (const interaction of interactions) {
    if (interaction.eventType === 'textbook_add') {
      unitsCreated++;
    } else if (interaction.eventType === 'textbook_update') {
      unitsUpdated++;
    }
    
    // Collect unique concept IDs
    const concepts = interaction.conceptIds || interaction.outputs?.concept_id ? 
      [interaction.outputs?.concept_id].filter(Boolean) : [];
    for (const conceptId of concepts) {
      uniqueConcepts.add(conceptId);
    }
  }

  // Also count from textbook state (for final snapshot)
  for (const learnerTextbooks of Object.values(textbooks)) {
    for (const unit of learnerTextbooks) {
      if (unit.conceptIds) {
        for (const conceptId of unit.conceptIds) {
          uniqueConcepts.add(conceptId);
        }
      }
      if (unit.conceptId) {
        uniqueConcepts.add(unit.conceptId);
      }
    }
  }

  return {
    unitsCreated,
    unitsUpdated,
    uniqueConcepts: uniqueConcepts.size
  };
}

/**
 * Compute groundedness rate (help with sources vs without)
 */
function computeGroundednessRate(interactions) {
  // Events that should be grounded (hints, explanations, textbook adds)
  const guidanceEvents = interactions.filter(i => 
    i.eventType === 'hint_view' || 
    i.eventType === 'explanation_view' ||
    i.eventType === 'textbook_add' ||
    i.eventType === 'textbook_update' ||
    i.eventType === 'llm_generate'
  );

  let groundedEvents = 0;
  let totalSources = 0;

  for (const event of guidanceEvents) {
    const sources = event.retrievedSourceIds || 
                   event.provenance?.retrievedSourceIds ||
                   event.outputs?.retrieved_source_ids ||
                   [];
    
    const hasSqlEngageSource = event.sqlEngageRowId || 
                               event.sqlEngageSubtype ||
                               event.outputs?.sql_engage_row_id ||
                               (event.eventType === 'hint_view' && event.hintLevel);
    
    if (sources.length > 0 || hasSqlEngageSource) {
      groundedEvents++;
      totalSources += sources.length || (hasSqlEngageSource ? 1 : 0);
    }
  }

  const totalEvents = guidanceEvents.length;
  
  if (totalEvents === 0) {
    return {
      percentage: 0,
      groundedEvents: 0,
      totalEvents: 0,
      averageSourcesPerEvent: 0
    };
  }

  return {
    percentage: round((groundedEvents / totalEvents) * 100, 1),
    groundedEvents,
    totalEvents,
    averageSourcesPerEvent: round(totalSources / totalEvents, 1)
  };
}

/**
 * Group interactions by problem ID
 */
function groupByProblem(interactions) {
  const groups = {};
  for (const interaction of interactions) {
    const problemId = interaction.problemId;
    if (!problemId) continue;
    
    if (!groups[problemId]) {
      groups[problemId] = [];
    }
    groups[problemId].push(interaction);
  }
  return groups;
}

/**
 * Round a number to specified decimal places
 */
function round(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function showHelp() {
  console.log(`
Usage: node replay-metrics.mjs [export-file.json]

Computes summary metrics from exported session data.

Arguments:
  export-file.json    Path to the exported session data JSON file
                      (default: dist/weekly-demo/export.json)

Metrics Computed:
  - summary:          Total interactions, guidance events, escalations
  - rungDistribution: How often each rung (1/2/3) was shown
  - escalationReasons: Count by trigger type (learner_request, rung_exhausted, etc.)
  - timeToEscalation: Average errors/time/hints before escalation
  - textbookGrowth:   Units created/updated, unique concepts
  - groundednessRate: Percentage of help with sources

Example:
  node scripts/replay-metrics.mjs dist/weekly-demo/export.json
  node scripts/replay-metrics.mjs ./my-export.json > metrics.json
`);
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const exportPath = args[0] || path.join(__dirname, '..', 'dist', 'weekly-demo', 'export.json');

  try {
    const exportDataRaw = await readFile(exportPath, 'utf8');
    const exportData = JSON.parse(exportDataRaw);

    const metrics = computeMetrics(exportData);

    console.log(JSON.stringify(metrics, null, 2));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: File not found: ${exportPath}`);
      console.error(`Use --help for usage information.`);
    } else if (error instanceof SyntaxError) {
      console.error(`Error: Invalid JSON in export file: ${error.message}`);
    } else {
      console.error(`Error processing export file: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run if executed directly
main();
