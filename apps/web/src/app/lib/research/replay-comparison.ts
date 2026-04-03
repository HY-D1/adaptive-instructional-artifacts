/**
 * Replay Comparison Module (Workstream 10)
 *
 * Provides policy variant comparison capabilities for research analysis.
 * Enables comparison of different LLM-assisted policy variants.
 */

import type { InteractionEvent, InstructionalUnit } from '../../types';

/**
 * Policy variant definition for comparison
 */
export type PolicyVariant = {
  /** Unique identifier for this variant */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the policy */
  description: string;
  /** Provider used (ollama or groq) */
  provider: 'ollama' | 'groq';
  /** Model used */
  model: string;
  /** Generation mode */
  generationMode: 'cheap_mode' | 'quality_mode';
  /** Whether retrieval-first routing is enabled */
  retrievalFirst: boolean;
  /** Escalation policy ID */
  escalationPolicy: string;
};

/**
 * Comparison metrics for a single variant
 */
export type VariantMetrics = {
  /** Total number of LLM generations */
  totalGenerations: number;
  /** Average escalation depth (1-3) */
  avgEscalationDepth: number;
  /** Number of textbook units created */
  textbookUnitsCreated: number;
  /** Average helpfulness rating (if available) */
  avgHelpfulnessRating?: number;
  /** Total tokens used (if available) */
  totalTokensUsed?: number;
  /** Average latency per generation */
  avgLatencyMs: number;
  /** Cost proxy (token count or API calls) */
  costProxy: number;
};

/**
 * Comparison result between variants
 */
export type ComparisonResult = {
  /** Variants being compared */
  variants: PolicyVariant[];
  /** Metrics for each variant */
  metrics: Record<string, VariantMetrics>;
  /** Winner variant ID for each metric */
  winners: Record<keyof VariantMetrics, string | null>;
  /** Statistical significance tests (if applicable) */
  significanceTests?: Record<string, {
    pValue: number;
    significant: boolean;
  }>;
  /** Timestamp of comparison */
  generatedAt: number;
};

/**
 * Predefined policy variants for comparison
 */
export const DEFAULT_VARIANTS: PolicyVariant[] = [
  {
    id: 'ollama-retrieval',
    name: 'Ollama + Retrieval-First',
    description: 'Local Ollama with retrieval-first routing (baseline)',
    provider: 'ollama',
    model: 'qwen3:4b',
    generationMode: 'quality_mode',
    retrievalFirst: true,
    escalationPolicy: 'adaptive',
  },
  {
    id: 'groq-cheap',
    name: 'Groq + Cheap Mode',
    description: 'Hosted Groq with cheap mode for cost efficiency',
    provider: 'groq',
    model: 'gpt-oss-20b',
    generationMode: 'cheap_mode',
    retrievalFirst: true,
    escalationPolicy: 'adaptive',
  },
  {
    id: 'groq-quality',
    name: 'Groq + Quality Mode',
    description: 'Hosted Groq with quality mode for best results',
    provider: 'groq',
    model: 'gpt-oss-20b',
    generationMode: 'quality_mode',
    retrievalFirst: true,
    escalationPolicy: 'adaptive',
  },
];

/**
 * Calculate metrics for a single variant from interaction events
 */
export function calculateVariantMetrics(
  events: InteractionEvent[],
  units: InstructionalUnit[]
): VariantMetrics {
  const llmEvents = events.filter(e => e.eventType === 'llm_generate');
  const textbookEvents = events.filter(e =>
    e.eventType === 'textbook_unit_upsert' || e.eventType === 'textbook_add'
  );

  // Calculate average escalation depth from hint_request events
  const hintEvents = events.filter(e => e.eventType === 'hint_request');
  const avgEscalationDepth = hintEvents.length > 0
    ? hintEvents.reduce((sum, e) => sum + (e.rung || 1), 0) / hintEvents.length
    : 0;

  // Calculate average latency from LLM events
  const latencies = llmEvents
    .map(e => e.llmLatencyMs)
    .filter((l): l is number => typeof l === 'number');
  const avgLatencyMs = latencies.length > 0
    ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
    : 0;

  // Calculate total tokens
  const totalTokens = llmEvents.reduce((sum, e) =>
    sum + (e.llmInputTokens || 0) + (e.llmOutputTokens || 0), 0
  );

  return {
    totalGenerations: llmEvents.length,
    avgEscalationDepth: Number(avgEscalationDepth.toFixed(2)),
    textbookUnitsCreated: textbookEvents.length,
    avgLatencyMs: Math.round(avgLatencyMs),
    costProxy: totalTokens || llmEvents.length, // Fall back to event count if tokens unavailable
  };
}

/**
 * Compare multiple policy variants
 */
export function compareVariants(
  variants: PolicyVariant[],
  eventLog: Record<string, InteractionEvent[]>,
  unitLog: Record<string, InstructionalUnit[]>
): ComparisonResult {
  const metrics: Record<string, VariantMetrics> = {};

  // Calculate metrics for each variant
  for (const variant of variants) {
    const events = eventLog[variant.id] || [];
    const units = unitLog[variant.id] || [];
    metrics[variant.id] = calculateVariantMetrics(events, units);
  }

  // Determine winners for each metric
  const winners: Record<keyof VariantMetrics, string | null> = {
    totalGenerations: findMinWinner(metrics, 'totalGenerations'),
    avgEscalationDepth: findOptimalEscalationWinner(metrics),
    textbookUnitsCreated: findMaxWinner(metrics, 'textbookUnitsCreated'),
    avgHelpfulnessRating: findMaxWinner(metrics, 'avgHelpfulnessRating'),
    totalTokensUsed: findMinWinner(metrics, 'totalTokensUsed'),
    avgLatencyMs: findMinWinner(metrics, 'avgLatencyMs'),
    costProxy: findMinWinner(metrics, 'costProxy'),
  };

  return {
    variants,
    metrics,
    winners,
    generatedAt: Date.now(),
  };
}

/**
 * Find variant with minimum value for a metric
 */
function findMinWinner(
  metrics: Record<string, VariantMetrics>,
  key: keyof VariantMetrics
): string | null {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  const validEntries = entries.filter(([, m]) => typeof m[key] === 'number');
  if (validEntries.length === 0) return null;

  return validEntries.reduce((min, [id, m]) =>
    (m[key] as number) < (metrics[min][key] as number) ? id : min
  , validEntries[0][0]);
}

/**
 * Find variant with maximum value for a metric
 */
function findMaxWinner(
  metrics: Record<string, VariantMetrics>,
  key: keyof VariantMetrics
): string | null {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  const validEntries = entries.filter(([, m]) => typeof m[key] === 'number');
  if (validEntries.length === 0) return null;

  return validEntries.reduce((max, [id, m]) =>
    (m[key] as number) > (metrics[max][key] as number) ? id : max
  , validEntries[0][0]);
}

/**
 * Find variant with optimal escalation depth (closer to 2.0 is better)
 */
function findOptimalEscalationWinner(
  metrics: Record<string, VariantMetrics>
): string | null {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  return entries.reduce((closest, [id, m]) => {
    const currentDiff = Math.abs(m.avgEscalationDepth - 2.0);
    const closestDiff = Math.abs(metrics[closest].avgEscalationDepth - 2.0);
    return currentDiff < closestDiff ? id : closest;
  }, entries[0][0]);
}

/**
 * Export comparison result as CSV for analysis
 */
export function exportComparisonAsCSV(result: ComparisonResult): string {
  const headers = [
    'variant_id',
    'variant_name',
    'provider',
    'model',
    'generation_mode',
    'total_generations',
    'avg_escalation_depth',
    'textbook_units_created',
    'avg_latency_ms',
    'cost_proxy',
  ].join(',');

  const rows = result.variants.map(v => {
    const m = result.metrics[v.id];
    return [
      v.id,
      v.name,
      v.provider,
      v.model,
      v.generationMode,
      m.totalGenerations,
      m.avgEscalationDepth,
      m.textbookUnitsCreated,
      m.avgLatencyMs,
      m.costProxy,
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}
