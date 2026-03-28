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
    const units = await getCorpusUnitsIndex();
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
    const response: ApiResponse<{ unit: typeof unit; chunks: typeof chunks }> = {
      success: true,
      data: { unit, chunks },
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
    const results = await searchCorpus(query, limit);
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
