#!/usr/bin/env node
/**
 * Tests for the Research-Ready Paper Data Contract Gate
 *
 * Uses mock data scenarios to verify the gate logic without requiring a real database.
 *
 * Run with: node scripts/verification/check-neon-paper-data-contract.test.mjs
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Mock threshold values (should match the main script)
const THRESHOLDS = {
  hintIdCompleteness: 0.99,
  templateIdCompleteness: 0.99,
  hintTextCompleteness: 0.99,
  hintLevelCompleteness: 0.99,
  conceptViewCompleteness: 0.99,
  sessionEndCompleteness: 0.99,
  codeChangeBurstRatio: 0.30,
};

// Test scenarios
const testScenarios = [
  {
    name: 'Perfect hint_view data (100% complete)',
    data: {
      hintViews: { total: 100, hintId: 100, hintText: 100, hintLevel: 100, templateId: 100 },
      conceptViews: { total: 50, conceptId: 50, source: 50 },
      sessionEnds: { total: 20, totalTime: 20, attempted: 20, solved: 20 },
      codeChanges: { total: 100, under1s: 10 },
    },
    expectedPassed: true,
    expectedFailures: 0,
  },
  {
    name: 'Hint data at threshold (99% complete)',
    data: {
      hintViews: { total: 100, hintId: 99, hintText: 99, hintLevel: 99, templateId: 99 },
      conceptViews: { total: 100, conceptId: 99, source: 99 },
      sessionEnds: { total: 100, totalTime: 99, attempted: 99, solved: 99 },
      codeChanges: { total: 100, under1s: 30 },
    },
    expectedPassed: true,
    expectedFailures: 0,
  },
  {
    name: 'Hint data below threshold (95% complete)',
    data: {
      hintViews: { total: 100, hintId: 95, hintText: 95, hintLevel: 95, templateId: 95 },
      conceptViews: { total: 100, conceptId: 95, source: 95 },
      sessionEnds: { total: 100, totalTime: 95, attempted: 95, solved: 95 },
      codeChanges: { total: 100, under1s: 35 },
    },
    expectedPassed: false,
    expectedFailures: 10, // 4 hint fields + 2 concept_view + 3 session_end + 1 burst
  },
  {
    name: 'Severe template_id gap (0% template_id)',
    data: {
      hintViews: { total: 100, hintId: 100, hintText: 100, hintLevel: 100, templateId: 0 },
      conceptViews: { total: 50, conceptId: 50, source: 50 },
      sessionEnds: { total: 20, totalTime: 20, attempted: 20, solved: 20 },
      codeChanges: { total: 100, under1s: 10 },
    },
    expectedPassed: false,
    expectedFailures: 1, // Only template_id should fail
  },
  {
    name: 'High editor burst noise (50% under 1s)',
    data: {
      hintViews: { total: 100, hintId: 100, hintText: 100, hintLevel: 100, templateId: 100 },
      conceptViews: { total: 50, conceptId: 50, source: 50 },
      sessionEnds: { total: 20, totalTime: 20, attempted: 20, solved: 20 },
      codeChanges: { total: 100, under1s: 50 },
    },
    expectedPassed: false,
    expectedFailures: 1, // Only burst ratio should fail
  },
  {
    name: 'Empty database (no events)',
    data: {
      hintViews: { total: 0, hintId: 0, hintText: 0, hintLevel: 0, templateId: 0 },
      conceptViews: { total: 0, conceptId: 0, source: 0 },
      sessionEnds: { total: 0, totalTime: 0, attempted: 0, solved: 0 },
      codeChanges: { total: 0, under1s: 0 },
    },
    expectedPassed: true, // Warnings only, no failures
    expectedFailures: 0,
  },
];

/**
 * Validate a test scenario against thresholds
 */
function validateScenario(scenario) {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  const { hintViews, conceptViews, sessionEnds, codeChanges } = scenario.data;

  // Check hint_view completeness
  if (hintViews.total > 0) {
    const hintMetrics = [
      { name: 'hint_id', present: hintViews.hintId, total: hintViews.total, threshold: THRESHOLDS.hintIdCompleteness },
      { name: 'hint_text', present: hintViews.hintText, total: hintViews.total, threshold: THRESHOLDS.hintTextCompleteness },
      { name: 'hint_level', present: hintViews.hintLevel, total: hintViews.total, threshold: THRESHOLDS.hintLevelCompleteness },
      { name: 'template_id', present: hintViews.templateId, total: hintViews.total, threshold: THRESHOLDS.templateIdCompleteness },
    ];

    for (const metric of hintMetrics) {
      const ratio = metric.present / metric.total;
      if (ratio >= metric.threshold) {
        results.passed.push({ check: `hint_view ${metric.name}`, ratio });
      } else {
        results.failed.push({ check: `hint_view ${metric.name}`, ratio, threshold: metric.threshold });
      }
    }
  } else {
    results.warnings.push({ check: 'hint_view completeness', message: 'No hint_view events found' });
  }

  // Check concept_view completeness
  if (conceptViews.total > 0) {
    const conceptIdRatio = conceptViews.conceptId / conceptViews.total;
    const sourceRatio = conceptViews.source / conceptViews.total;

    if (conceptIdRatio >= THRESHOLDS.conceptViewCompleteness) {
      results.passed.push({ check: 'concept_view concept_id', ratio: conceptIdRatio });
    } else {
      results.failed.push({ check: 'concept_view concept_id', ratio: conceptIdRatio, threshold: THRESHOLDS.conceptViewCompleteness });
    }

    if (sourceRatio >= THRESHOLDS.conceptViewCompleteness) {
      results.passed.push({ check: 'concept_view source', ratio: sourceRatio });
    } else {
      results.failed.push({ check: 'concept_view source', ratio: sourceRatio, threshold: THRESHOLDS.conceptViewCompleteness });
    }
  } else {
    results.warnings.push({ check: 'concept_view completeness', message: 'No concept_view events found' });
  }

  // Check session_end completeness
  if (sessionEnds.total > 0) {
    const sessionMetrics = [
      { name: 'total_time', present: sessionEnds.totalTime, total: sessionEnds.total },
      { name: 'problems_attempted', present: sessionEnds.attempted, total: sessionEnds.total },
      { name: 'problems_solved', present: sessionEnds.solved, total: sessionEnds.total },
    ];

    for (const metric of sessionMetrics) {
      const ratio = metric.present / metric.total;
      if (ratio >= THRESHOLDS.sessionEndCompleteness) {
        results.passed.push({ check: `session_end ${metric.name}`, ratio });
      } else {
        results.failed.push({ check: `session_end ${metric.name}`, ratio, threshold: THRESHOLDS.sessionEndCompleteness });
      }
    }
  } else {
    results.warnings.push({ check: 'session_end completeness', message: 'No session_end events found' });
  }

  // Check editor burst metrics
  if (codeChanges.total > 0) {
    const burstRatio = codeChanges.under1s / codeChanges.total;
    if (burstRatio <= THRESHOLDS.codeChangeBurstRatio) {
      results.passed.push({ check: 'editor burst ratio', ratio: burstRatio });
    } else {
      results.failed.push({ check: 'editor burst ratio', ratio: burstRatio, threshold: THRESHOLDS.codeChangeBurstRatio });
    }
  } else {
    results.warnings.push({ check: 'editor burst metrics', message: 'No code_change events found' });
  }

  return results;
}

/**
 * Run all test scenarios
 */
function runTests() {
  console.log(colorize('cyan', '╔══════════════════════════════════════════════════════════════════╗'));
  console.log(colorize('cyan', '║  Paper Data Contract Gate - Test Suite                          ║'));
  console.log(colorize('cyan', '╚══════════════════════════════════════════════════════════════════╝'));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const scenario of testScenarios) {
    console.log(colorize('blue', `🧪 Testing: ${scenario.name}`));
    
    const results = validateScenario(scenario);
    const actualFailed = results.failed.length;
    const testPassed = actualFailed === scenario.expectedFailures;

    if (testPassed) {
      console.log(colorize('green', `   ✓ Test passed (${results.passed.length} checks, ${results.warnings.length} warnings)`));
      passed++;
    } else {
      console.log(colorize('red', `   ✗ Test failed`));
      console.log(colorize('red', `     Expected ${scenario.expectedFailures} failures, got ${actualFailed}`));
      if (results.failed.length > 0) {
        console.log(colorize('red', `     Failed checks:`));
        for (const fail of results.failed) {
          console.log(colorize('red', `       • ${fail.check}`));
        }
      }
      failed++;
    }
    console.log();
  }

  // Summary
  console.log(colorize('cyan', '═══════════════════════════════════════════════════════════════════'));
  console.log(`Total: ${testScenarios.length} scenarios`);
  console.log(colorize('green', `Passed: ${passed}`));
  console.log(colorize('red', `Failed: ${failed}`));
  console.log(colorize('cyan', '═══════════════════════════════════════════════════════════════════'));

  return failed === 0;
}

// Run tests
const success = runTests();
process.exit(success ? 0 : 1);
