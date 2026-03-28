import { Router, Request, Response } from 'express';
import type { ApiResponse } from '../types.js';
import {
  getCorpusChunksByUnitId,
  getCorpusManifest,
  getCorpusUnitById,
  getCorpusUnitsIndex,
  isUsingNeon,
  searchCorpus,
} from '../db/index.js';

const router = Router();

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function asString(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function extractPageFromUnitId(unitId: string): number | undefined {
  const match = /\/page-(\d+)$/i.exec(unitId);
  if (!match) return undefined;
  const page = Number(match[1]);
  return Number.isFinite(page) && page > 0 ? page : undefined;
}

function deriveDisplayTitle(unit: { title: string; summary: string; contentMarkdown?: string }): string {
  const title = normalizeText(unit.title);
  if (title && !/^page\s+\d+$/i.test(title)) {
    return title;
  }

  const source = normalizeText(unit.summary) || normalizeText(unit.contentMarkdown);
  if (!source) return title || 'Untitled Concept';
  const firstSentence = source.split(/(?<=[.!?])\s+/)[0] || source;
  const clipped = firstSentence.slice(0, 80).replace(/[-_.,:; ]+$/g, '');
  return clipped.length >= 8 ? clipped : (title || 'Untitled Concept');
}

function deriveDisplaySummary(unit: { summary: string; contentMarkdown?: string }): string {
  const source = normalizeText(unit.summary) || normalizeText(unit.contentMarkdown);
  if (!source) return '';
  if (source.length <= 220) return source;
  const clip = source.slice(0, 221);
  const sentenceBreak = Math.max(clip.lastIndexOf('.'), clip.lastIndexOf(';'), clip.lastIndexOf(':'));
  if (sentenceBreak >= 90) return clip.slice(0, sentenceBreak + 1).trim();
  return `${clip.slice(0, 220).trim()}...`;
}

function deriveHintSourceExcerpt(unit: { summary: string; contentMarkdown?: string }): string {
  const source = normalizeText(unit.contentMarkdown) || normalizeText(unit.summary);
  if (!source) return '';
  if (source.length <= 180) return source;
  return source.slice(0, 180).replace(/[ ,.;]+$/g, '');
}

function deriveExplanationContext(unit: { summary: string; contentMarkdown?: string }): string {
  const summary = deriveDisplaySummary(unit);
  const body = normalizeText(unit.contentMarkdown);
  const combined = summary && body ? `${summary}\n\n${body}` : (summary || body);
  if (combined.length <= 420) return combined;
  return `${combined.slice(0, 420).trim()}...`;
}

function shapeUnitForProduct<T extends {
  unitId: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  pageStart: number;
  pageEnd: number;
  metadata: Record<string, unknown> | null;
}>(unit: T) {
  const metadata = (unit.metadata ?? {}) as Record<string, unknown>;
  const fromMetadataFlags = Array.isArray(metadata.quality_flags)
    ? metadata.quality_flags.filter((v): v is string => typeof v === 'string')
    : [];
  const derivedFlags = new Set(fromMetadataFlags);
  if (/^page\s+\d+$/i.test(unit.title)) {
    derivedFlags.add('generic_title');
  }
  const displayTitle = asString(metadata.display_title) || deriveDisplayTitle(unit);
  const displaySummary = asString(metadata.display_summary) || deriveDisplaySummary(unit);
  const hintSourceExcerpt = asString(metadata.hint_source_excerpt) || deriveHintSourceExcerpt(unit);
  const explanationContext = asString(metadata.explanation_context) || deriveExplanationContext(unit);
  const productFitScore = asNumber(metadata.product_fit_score) ?? (
    derivedFlags.has('high_noise') ? 0.4 : 0.75
  );
  const pageFromUnitId = extractPageFromUnitId(unit.unitId);
  const normalizedPageStart = (
    pageFromUnitId &&
    unit.pageStart > 0 &&
    unit.pageEnd >= unit.pageStart &&
    unit.pageEnd - unit.pageStart >= 20
  ) ? pageFromUnitId : unit.pageStart;
  const normalizedPageEnd = (
    pageFromUnitId &&
    unit.pageStart > 0 &&
    unit.pageEnd >= unit.pageStart &&
    unit.pageEnd - unit.pageStart >= 20
  ) ? pageFromUnitId : unit.pageEnd;

  return {
    ...unit,
    pageStart: normalizedPageStart,
    pageEnd: normalizedPageEnd,
    displayTitle,
    displaySummary,
    hintSourceExcerpt,
    explanationContext,
    productFitScore: Number(productFitScore.toFixed(4)),
    qualityFlags: Array.from(derivedFlags).sort(),
  };
}

router.get('/manifest', async (_req: Request, res: Response) => {
  if (!isUsingNeon()) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Corpus API requires Neon mode',
      message: 'Set DATABASE_URL (or Neon env aliases) to enable remote corpus.',
    };
    res.status(503).json(response);
    return;
  }

  try {
    const docs = await getCorpusManifest();
    const units = (await getCorpusUnitsIndex())
      .map((unit) => shapeUnitForProduct(unit))
      .sort((a, b) => {
        if (a.docId !== b.docId) return a.docId.localeCompare(b.docId);
        if (a.pageStart !== b.pageStart) return a.pageStart - b.pageStart;
        if (a.pageEnd !== b.pageEnd) return a.pageEnd - b.pageEnd;
        return a.unitId.localeCompare(b.unitId);
      });
    const response: ApiResponse<{ documents: typeof docs; units: typeof units }> = {
      success: true,
      data: { documents: docs, units },
      message: `Loaded ${docs.length} corpus document(s).`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to read corpus manifest',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

router.get('/unit/:unitId', async (req: Request, res: Response) => {
  if (!isUsingNeon()) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Corpus API requires Neon mode',
      message: 'Set DATABASE_URL (or Neon env aliases) to enable remote corpus.',
    };
    res.status(503).json(response);
    return;
  }

  const { unitId } = req.params;
  if (!unitId) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Missing unitId',
      message: 'unitId path parameter is required',
    };
    res.status(400).json(response);
    return;
  }

  try {
    const unit = await getCorpusUnitById(unitId);
    if (!unit) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unit not found',
        message: `No corpus unit found for id ${unitId}`,
      };
      res.status(404).json(response);
      return;
    }

    const chunks = await getCorpusChunksByUnitId(unitId, 100);
    const shapedUnit = shapeUnitForProduct(unit);
    const response: ApiResponse<{ unit: typeof unit; chunks: typeof chunks }> = {
      success: true,
      data: { unit: shapedUnit, chunks },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to read corpus unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

router.post('/search', async (req: Request, res: Response) => {
  if (!isUsingNeon()) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Corpus API requires Neon mode',
      message: 'Set DATABASE_URL (or Neon env aliases) to enable remote corpus.',
    };
    res.status(503).json(response);
    return;
  }

  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const limitRaw = Number(req.body?.limit ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 10;

  if (!query) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Invalid query',
      message: 'query must be a non-empty string',
    };
    res.status(400).json(response);
    return;
  }

  try {
    const rawResults = await searchCorpus(query, Math.max(limit * 4, 40));
    const results = rawResults
      .sort((a, b) => {
        if (b.termHits !== a.termHits) return b.termHits - a.termHits;
        const aScore = asNumber((a.metadata ?? {}).product_fit_score) ?? 0;
        const bScore = asNumber((b.metadata ?? {}).product_fit_score) ?? 0;
        if (bScore !== aScore) return bScore - aScore;
        if (a.page !== b.page) return a.page - b.page;
        return a.chunkId.localeCompare(b.chunkId);
      })
      .slice(0, limit);
    const response: ApiResponse<{ query: string; limit: number; results: typeof results }> = {
      success: true,
      data: {
        query,
        limit,
        results,
      },
      message: `Found ${results.length} corpus chunk(s).`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Corpus search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export const corpusRouter = router;
