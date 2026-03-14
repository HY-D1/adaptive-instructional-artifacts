/**
 * Error Transition Matrix Module
 * 
 * Analyzes error patterns to understand how learners transition
 * from one error type to another.
 */

import type { InteractionEvent } from '../../types';

export interface ErrorTransitionMatrix {
  fromError: string;
  toError: string;
  count: number;
  probability: number;
}

export interface ErrorTransitionStats {
  transitions: ErrorTransitionMatrix[];
  mostCommonTransition: ErrorTransitionMatrix | null;
  errorChains: ErrorChain[];
  selfLoopErrors: string[]; // Errors that tend to repeat
}

export interface ErrorChain {
  startError: string;
  chain: string[];
  count: number;
  length: number;
}

interface SessionGrouping {
  learnerId: string;
  sessionId: string;
  interactions: InteractionEvent[];
}

/**
 * Build error transition matrix: what error follows what error
 */
export function buildErrorTransitionMatrix(
  interactions: InteractionEvent[]
): ErrorTransitionMatrix[] {
  if (interactions.length === 0) {
    return [];
  }

  // Group interactions by learner and session
  const sessions = groupBySession(interactions);
  
  const transitions = new Map<string, number>();
  const fromCounts = new Map<string, number>();
  
  for (const session of sessions) {
    const errors = session.interactions.filter(i => i.eventType === 'error');
    
    for (let i = 0; i < errors.length - 1; i++) {
      const from = errors[i].errorSubtypeId || 'unknown';
      const to = errors[i + 1].errorSubtypeId || 'unknown';
      const key = `${from}|${to}`;
      
      transitions.set(key, (transitions.get(key) || 0) + 1);
      fromCounts.set(from, (fromCounts.get(from) || 0) + 1);
    }
  }
  
  // Convert to matrix format
  const matrix: ErrorTransitionMatrix[] = [];
  for (const [key, count] of transitions) {
    const [from, to] = key.split('|');
    const totalFrom = fromCounts.get(from) || 1;
    
    matrix.push({
      fromError: from,
      toError: to,
      count,
      probability: count / totalFrom
    });
  }
  
  return matrix.sort((a, b) => b.count - a.count);
}

/**
 * Build comprehensive error transition statistics
 */
export function buildErrorTransitionStats(
  interactions: InteractionEvent[]
): ErrorTransitionStats {
  const transitions = buildErrorTransitionMatrix(interactions);
  
  const mostCommonTransition = transitions.length > 0 ? transitions[0] : null;
  
  const sessions = groupBySession(interactions);
  const errorChains = extractErrorChains(sessions);
  
  // Find errors that tend to repeat (self-loops)
  const selfLoopErrors = transitions
    .filter(t => t.fromError === t.toError && t.probability > 0.3)
    .map(t => t.fromError);
  
  return {
    transitions,
    mostCommonTransition,
    errorChains,
    selfLoopErrors
  };
}

function groupBySession(interactions: InteractionEvent[]): SessionGrouping[] {
  const sessions = new Map<string, SessionGrouping>();
  
  for (const interaction of interactions) {
    const key = `${interaction.learnerId}-${interaction.sessionId || 'default'}`;
    
    if (!sessions.has(key)) {
      sessions.set(key, {
        learnerId: interaction.learnerId,
        sessionId: interaction.sessionId || 'default',
        interactions: []
      });
    }
    
    sessions.get(key)!.interactions.push(interaction);
  }
  
  // Sort interactions within each session by timestamp
  for (const session of sessions.values()) {
    session.interactions.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  return Array.from(sessions.values());
}

function extractErrorChains(sessions: SessionGrouping[]): ErrorChain[] {
  const chainCounts = new Map<string, number>();
  
  for (const session of sessions) {
    const errors = session.interactions.filter(i => i.eventType === 'error');
    if (errors.length < 2) continue;
    
    // Extract chains of 2-4 consecutive errors
    for (let length = 2; length <= Math.min(4, errors.length); length++) {
      for (let i = 0; i <= errors.length - length; i++) {
        const chain = errors.slice(i, i + length).map(e => e.errorSubtypeId || 'unknown');
        const chainKey = chain.join('->');
        chainCounts.set(chainKey, (chainCounts.get(chainKey) || 0) + 1);
      }
    }
  }
  
  // Convert to ErrorChain objects, filter for chains that appear at least twice
  const chains: ErrorChain[] = [];
  for (const [chainKey, count] of chainCounts) {
    if (count >= 2) {
      const errorTypes = chainKey.split('->');
      chains.push({
        startError: errorTypes[0],
        chain: errorTypes.slice(1),
        count,
        length: errorTypes.length
      });
    }
  }
  
  return chains.sort((a, b) => b.count - a.count);
}

/**
 * Get error recovery patterns - which errors are followed by success
 */
export function getErrorRecoveryPatterns(
  interactions: InteractionEvent[]
): Array<{ errorType: string; recoveryRate: number; count: number }> {
  const sessions = groupBySession(interactions);
  const recoveryStats = new Map<string, { errors: number; recoveries: number }>();
  
  for (const session of sessions) {
    const sorted = session.interactions;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].eventType === 'error') {
        const errorType = sorted[i].errorSubtypeId || 'unknown';
        
        if (!recoveryStats.has(errorType)) {
          recoveryStats.set(errorType, { errors: 0, recoveries: 0 });
        }
        
        const stats = recoveryStats.get(errorType)!;
        stats.errors++;
        
        // Check if followed by success (within 3 interactions)
        for (let j = i + 1; j < Math.min(i + 4, sorted.length); j++) {
          if (sorted[j].eventType === 'execution' && sorted[j].successful) {
            stats.recoveries++;
            break;
          }
          if (sorted[j].eventType === 'error') break; // Another error interrupts
        }
      }
    }
  }
  
  return Array.from(recoveryStats.entries())
    .map(([errorType, stats]) => ({
      errorType,
      recoveryRate: stats.errors > 0 ? stats.recoveries / stats.errors : 0,
      count: stats.errors
    }))
    .sort((a, b) => b.recoveryRate - a.recoveryRate);
}

/**
 * Analyze error patterns before hint requests
 */
export function getErrorsBeforeHints(
  interactions: InteractionEvent[]
): Array<{ errorType: string; hintRequestRate: number; count: number }> {
  const sessions = groupBySession(interactions);
  const hintStats = new Map<string, { occurrences: number; followedByHint: number }>();
  
  for (const session of sessions) {
    const sorted = session.interactions;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].eventType === 'error') {
        const errorType = sorted[i].errorSubtypeId || 'unknown';
        
        if (!hintStats.has(errorType)) {
          hintStats.set(errorType, { occurrences: 0, followedByHint: 0 });
        }
        
        const stats = hintStats.get(errorType)!;
        stats.occurrences++;
        
        // Check if followed by hint request (within 2 interactions)
        for (let j = i + 1; j < Math.min(i + 3, sorted.length); j++) {
          if (
            sorted[j].eventType === 'hint_request' ||
            sorted[j].eventType === 'guidance_request'
          ) {
            stats.followedByHint++;
            break;
          }
          if (sorted[j].eventType === 'execution') break; // Execution interrupts
        }
      }
    }
  }
  
  return Array.from(hintStats.entries())
    .map(([errorType, stats]) => ({
      errorType,
      hintRequestRate: stats.occurrences > 0 ? stats.followedByHint / stats.occurrences : 0,
      count: stats.occurrences
    }))
    .sort((a, b) => b.hintRequestRate - a.hintRequestRate);
}
