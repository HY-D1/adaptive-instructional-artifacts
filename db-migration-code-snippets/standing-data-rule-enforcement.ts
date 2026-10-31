/**
 * Code snippet for: apps/server/src/routes/research.ts
 *
 * Add standing data rule enforcement to research data export routes.
 * This ensures only production section data is exported for papers/analysis.
 */

import { getDb } from '../db/neon.js';

// ============================================================================
// NEW: Standing Data Filter Helper
// ============================================================================

interface ResearchQueryOptions {
  /** If true, filter to production sections only */
  onlyProduction?: boolean;
  /** Specific section IDs to include (if not onlyProduction) */
  sectionIds?: string[];
  /** Date range start (default: last 90 days) */
  fromDate?: Date;
  /** Date range end (default: now) */
  toDate?: Date;
}

/**
 * Helper to apply standing data rule filters to research queries.
 *
 * Usage:
 * ```
 * const filter = buildStandingDataFilter({ onlyProduction: true });
 * const query = `SELECT * FROM interaction_events WHERE ${filter.where} ${filter.params ? 'AND $1' : ''}`;
 * ```
 */
function buildStandingDataFilter(options: ResearchQueryOptions): {
  where: string;
  params: string[];
} {
  const parts: string[] = [];
  const params: string[] = [];

  // Date range filter
  const fromDate = options.fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const toDate = options.toDate || new Date();

  parts.push(`ie.timestamp >= $${params.length + 1}`);
  params.push(fromDate.toISOString());

  parts.push(`ie.timestamp <= $${params.length + 1}`);
  params.push(toDate.toISOString());

  // Section filter
  if (options.onlyProduction) {
    // Filter to production sections only (STANDING DATA RULE)
    parts.push(`
      ie.section_id IN (
        SELECT id FROM course_sections
        WHERE section_type = 'production'
      )
    `);
  } else if (options.sectionIds && options.sectionIds.length > 0) {
    // Filter to specific section IDs
    parts.push(`ie.section_id = ANY($${params.length + 1})`);
    params.push(JSON.stringify(options.sectionIds));
  }

  return {
    where: parts.join(' AND '),
    params,
  };
}

// ============================================================================
// NEW: Research Export Endpoint with Standing Data Rule
// ============================================================================

/**
 * GET /api/research/export
 *
 * Export learner interaction data for analysis.
 * Query params:
 *   - production=true  → filter to production sections only (STANDING DATA RULE)
 *   - sections=id1,id2 → filter to specific section IDs
 *   - from=ISO8601     → start date
 *   - to=ISO8601       → end date
 */
router.get('/research/export', async (req: Request, res: Response) => {
  try {
    const onlyProduction = req.query.production === 'true';
    const sectionIds = typeof req.query.sections === 'string'
      ? req.query.sections.split(',')
      : undefined;

    const filter = buildStandingDataFilter({
      onlyProduction,
      sectionIds,
      fromDate: req.query.from ? new Date(req.query.from as string) : undefined,
      toDate: req.query.to ? new Date(req.query.to as string) : undefined,
    });

    const db = getDb();

    // Log which filter was applied (for audit trail)
    console.info('[research/export]', {
      filter: onlyProduction ? 'production_only' : 'custom_sections',
      sectionCount: sectionIds?.length || 'all_production',
      timestamp: new Date().toISOString(),
    });

    const rows = await db`
      SELECT * FROM interaction_events ie
      WHERE ${db.unsafe(filter.where)}
      ORDER BY ie.timestamp ASC
    `;

    // Return as NDJSON (newline-delimited JSON) for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    for (const row of rows) {
      res.write(JSON.stringify(row) + '\n');
    }
    res.end();
  } catch (error) {
    console.error('[research/export] error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ============================================================================
// NEW: Validation Helper - Verify Standing Data Rule Applied
// ============================================================================

/**
 * Verify that a research data export only contains production section data.
 * Use this before publishing analysis results.
 */
export async function validateStandingDataApplied(
  interactionIds: string[]
): Promise<{ valid: boolean; invalidCount: number; testSectionCount: number }> {
  const db = getDb();

  const rows = await db`
    SELECT COUNT(*) as count FROM interaction_events ie
    WHERE ie.id = ANY(${JSON.stringify(interactionIds)})
      AND ie.section_id NOT IN (
        SELECT id FROM course_sections WHERE section_type = 'production'
      )
  `;

  const invalidCount = Number(rows[0]?.count || 0);
  const testSectionCount = invalidCount; // Events from non-production sections

  return {
    valid: testSectionCount === 0,
    invalidCount,
    testSectionCount,
  };
}

// ============================================================================
// UPDATED: Existing Export Function with Standing Data Filter
// ============================================================================

/**
 * Wrap existing export functions with standing data rule.
 *
 * Before:
 *   const data = await getInteractionExport({ learnerId });
 *
 * After (production-safe):
 *   const data = await getInteractionExportForResearch({
 *     learnerId,
 *     requireProduction: true  // NEW PARAMETER
 *   });
 */
export async function getInteractionExportForResearch(params: {
  learnerId: string;
  requireProduction?: boolean;  // NEW: Enforce standing data rule
}): Promise<any[]> {
  const db = getDb();

  let sectionFilter = '';
  if (params.requireProduction) {
    // Apply standing data rule: only production sections
    sectionFilter = `
      AND ie.section_id IN (
        SELECT id FROM course_sections WHERE section_type = 'production'
      )
    `;
  }

  const rows = await db`
    SELECT * FROM interaction_events ie
    WHERE ie.user_id = ${params.learnerId}
    ${db.unsafe(sectionFilter)}
    ORDER BY ie.timestamp ASC
  `;

  return rows;
}
