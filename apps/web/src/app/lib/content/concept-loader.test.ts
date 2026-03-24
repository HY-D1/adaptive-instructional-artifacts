import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveConceptId,
  getConcept,
  loadConceptContent,
  clearConceptMapCache,
  getCompatibleCorpusIds,
  ConceptInfo
} from './concept-loader';

// Mock fetch globally
global.fetch = vi.fn();

describe('resolveConceptId', () => {
  const mockConcepts: Record<string, ConceptInfo> = {
    'select-basic': {
      id: 'select-basic',
      title: 'SELECT Basics',
      definition: 'Retrieve data from tables',
      difficulty: 'beginner',
      estimatedReadTime: 5,
      pageNumbers: [45],
      chunkIds: { definition: [], examples: [], commonMistakes: [] },
      relatedConcepts: [],
      practiceProblemIds: []
    },
    'where-clause': {
      id: 'where-clause',
      title: 'WHERE Clause',
      definition: 'Filter rows',
      difficulty: 'beginner',
      estimatedReadTime: 5,
      pageNumbers: [50],
      chunkIds: { definition: [], examples: [], commonMistakes: [] },
      relatedConcepts: [],
      practiceProblemIds: []
    },
    'murachs-mysql-3rd-edition/join': {
      id: 'murachs-mysql-3rd-edition/join',
      title: 'JOIN (Murach)',
      definition: 'Join tables',
      difficulty: 'intermediate',
      estimatedReadTime: 10,
      pageNumbers: [100],
      chunkIds: { definition: [], examples: [], commonMistakes: [] },
      relatedConcepts: [],
      practiceProblemIds: [],
      sourceDocId: 'murachs-mysql-3rd-edition'
    }
  };

  it('returns exact match for plain concept IDs', () => {
    const result = resolveConceptId('select-basic', mockConcepts);
    expect(result).toBe('select-basic');
  });

  it('resolves namespaced ID to plain ID via suffix match', () => {
    const result = resolveConceptId('murachs-mysql-3rd-edition/select-basic', mockConcepts);
    expect(result).toBe('select-basic');
  });

  it('returns namespaced ID if it exists as exact key', () => {
    const result = resolveConceptId('murachs-mysql-3rd-edition/join', mockConcepts);
    expect(result).toBe('murachs-mysql-3rd-edition/join');
  });

  it('returns original ID if no match found', () => {
    const result = resolveConceptId('nonexistent/concept', mockConcepts);
    expect(result).toBe('nonexistent/concept');
  });

  it('returns original ID if suffix not in map', () => {
    const result = resolveConceptId('doc/unknown-concept', mockConcepts);
    expect(result).toBe('doc/unknown-concept');
  });

  it('handles multiple slashes by taking last segment', () => {
    const concepts: Record<string, ConceptInfo> = {
      'deep': { 
        id: 'deep', 
        title: 'Deep',
        definition: '',
        difficulty: 'beginner',
        estimatedReadTime: 1,
        pageNumbers: [],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: []
      }
    };
    const result = resolveConceptId('a/b/c/deep', concepts);
    expect(result).toBe('deep');
  });

  it('resolves plain ID to namespaced ID when unique suffix match exists', () => {
    // Helper export format: only namespaced keys exist
    const helperConcepts: Record<string, ConceptInfo> = {
      'murachs-mysql-3rd-edition/select-statement-murach': {
        id: 'murachs-mysql-3rd-edition/select-statement-murach',
        title: 'SELECT Statement',
        definition: 'Retrieve data',
        difficulty: 'beginner',
        estimatedReadTime: 5,
        pageNumbers: [45],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: [],
        sourceDocId: 'murachs-mysql-3rd-edition'
      }
    };
    
    const result = resolveConceptId('select-statement-murach', helperConcepts);
    expect(result).toBe('murachs-mysql-3rd-edition/select-statement-murach');
  });

  it('returns original plain ID when multiple suffix matches exist (ambiguous)', () => {
    const concepts: Record<string, ConceptInfo> = {
      'doc1/select-basic': {
        id: 'doc1/select-basic',
        title: 'SELECT (Doc1)',
        definition: '',
        difficulty: 'beginner',
        estimatedReadTime: 1,
        pageNumbers: [],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: []
      },
      'doc2/select-basic': {
        id: 'doc2/select-basic',
        title: 'SELECT (Doc2)',
        definition: '',
        difficulty: 'beginner',
        estimatedReadTime: 1,
        pageNumbers: [],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: []
      }
    };
    
    // Should return original and log warning (ambiguous)
    const result = resolveConceptId('select-basic', concepts);
    expect(result).toBe('select-basic');
  });
});

describe('getConcept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConceptMapCache();
  });

  afterEach(() => {
    clearConceptMapCache();
  });

  it('fetches concept by exact ID', async () => {
    const mockMap = {
      version: '1.0',
      generatedAt: '2024-01-01',
      concepts: {
        'select-basic': {
          id: 'select-basic',
          title: 'SELECT Basics',
          definition: 'Retrieve data',
          difficulty: 'beginner',
          estimatedReadTime: 5,
          pageNumbers: [45],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: []
        }
      }
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMap)
    } as Response);

    const concept = await getConcept('select-basic');
    expect(concept).not.toBeNull();
    expect(concept?.id).toBe('select-basic');
    expect(concept?.title).toBe('SELECT Basics');
  });

  it('resolves namespaced ID to plain concept', async () => {
    const mockMap = {
      version: '1.0',
      generatedAt: '2024-01-01',
      concepts: {
        'select-basic': {
          id: 'select-basic',
          title: 'SELECT Basics',
          definition: 'Retrieve data',
          difficulty: 'beginner',
          estimatedReadTime: 5,
          pageNumbers: [45],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: []
        }
      }
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMap)
    } as Response);

    const concept = await getConcept('murachs/select-basic');
    expect(concept).not.toBeNull();
    expect(concept?.id).toBe('murachs/select-basic'); // Preserves original ID
    expect(concept?.title).toBe('SELECT Basics');
  });

  it('returns null for unknown concept', async () => {
    const mockMap = {
      version: '1.0',
      generatedAt: '2024-01-01',
      concepts: {}
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMap)
    } as Response);

    const concept = await getConcept('unknown-concept');
    expect(concept).toBeNull();
  });

  it('returns null if concept-map.json fails to load', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    const concept = await getConcept('select-basic');
    expect(concept).toBeNull();
  });
});

describe('loadConceptContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConceptMapCache();
  });

  afterEach(() => {
    clearConceptMapCache();
  });

  it('loads concept with markdown content', async () => {
    const mockMap = {
      version: '1.0',
      generatedAt: '2024-01-01',
      concepts: {
        'select-basic': {
          id: 'select-basic',
          title: 'SELECT Basics',
          definition: 'Retrieve data from tables',
          difficulty: 'beginner',
          estimatedReadTime: 5,
          pageNumbers: [45],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: []
        }
      }
    };

    const mockMarkdown = `---
id: select-basic
title: SELECT Basics
---

## Definition
Retrieve data from tables.

## Examples
### Basic SELECT
\`\`\`sql
SELECT * FROM users;
\`\`\`

## Common Mistakes
### Selecting all columns
❌ **Incorrect SQL**
\`\`\`sql
SELECT *
\`\`\`

✅ **Corrected SQL**
\`\`\`sql
SELECT id, name
\`\`\`
`;

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMap)
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockMarkdown)
      } as Response);

    const concept = await loadConceptContent('select-basic');
    expect(concept).not.toBeNull();
    expect(concept?.title).toBe('SELECT Basics');
    expect(concept?.content.definition).toBe('Retrieve data from tables.');
    expect(concept?.content.examples).toHaveLength(1);
    expect(concept?.content.examples[0].title).toBe('Basic SELECT');
    expect(concept?.content.commonMistakes).toHaveLength(1);
  });

  it('tries multiple file paths for namespaced concepts', async () => {
    const mockMap = {
      version: '1.0',
      generatedAt: '2024-01-01',
      concepts: {
        'select-basic': {
          id: 'select-basic',
          title: 'SELECT Basics',
          definition: 'Retrieve data',
          difficulty: 'beginner',
          estimatedReadTime: 5,
          pageNumbers: [45],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: []
        }
      }
    };

    const mockMarkdown = '## Definition\nTest content';

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMap)
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response) // First path fails
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockMarkdown)
      } as Response); // Second path succeeds

    const concept = await loadConceptContent('murachs/select-basic');
    expect(concept).not.toBeNull();
    
    // Should have tried both paths
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('returns null if markdown fetch fails', async () => {
    const mockMap = {
      version: '1.0',
      generatedAt: '2024-01-01',
      concepts: {
        'select-basic': {
          id: 'select-basic',
          title: 'SELECT Basics',
          definition: 'Retrieve data',
          difficulty: 'beginner',
          estimatedReadTime: 5,
          pageNumbers: [45],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: []
        }
      }
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMap)
      } as Response)
      .mockResolvedValue({
        ok: false,
        status: 404
      } as Response);

    const concept = await loadConceptContent('select-basic');
    expect(concept).toBeNull();
  });
});

// ─── Dual-textbook loader regression ─────────────────────────────────────────
// Verifies adaptive can load concepts from both textbooks using the namespaced
// format produced by the real PDF helper export.

describe('Dual-textbook loader: namespaced helper format', () => {
  // Mirrors the real helper concept-map.json structure after sync.
  const mockDualMap = {
    version: '1.0.0',
    generatedAt: '2026-03-21T00:00:00Z',
    sourceDocIds: ['murachs-mysql-3rd-edition', 'dbms-ramakrishnan-3rd-edition'],
    concepts: {
      // Representative Murach concept
      'murachs-mysql-3rd-edition/select-statement-murach': {
        id: 'murachs-mysql-3rd-edition/select-statement-murach',
        title: 'SELECT Statement (Murach)',
        definition: 'Retrieve rows from one or more tables',
        difficulty: 'beginner' as const,
        estimatedReadTime: 5,
        pageNumbers: [45],
        chunkIds: { definition: ['murach:p45:c1'], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: [],
        sourceDocId: 'murachs-mysql-3rd-edition',
      },
      // Real Ramakrishnan key from helper export (relational-model-intro)
      'dbms-ramakrishnan-3rd-edition/relational-model-intro': {
        id: 'dbms-ramakrishnan-3rd-edition/relational-model-intro',
        title: 'Introduction to Relational Databases',
        definition: 'Overview of database systems, relational model basics, and data independence',
        difficulty: 'beginner' as const,
        estimatedReadTime: 10,
        pageNumbers: [1, 2, 3],
        chunkIds: {
          definition: ['dbms-ramakrishnan-3rd-edition:p2:c1'],
          examples: ['dbms-ramakrishnan-3rd-edition:p6:c1'],
          commonMistakes: ['dbms-ramakrishnan-3rd-edition:p11:c1'],
        },
        relatedConcepts: [],
        practiceProblemIds: [],
        sourceDocId: 'dbms-ramakrishnan-3rd-edition',
      },
      // Another Ramakrishnan concept to confirm multiple resolve cleanly
      'dbms-ramakrishnan-3rd-edition/normalization': {
        id: 'dbms-ramakrishnan-3rd-edition/normalization',
        title: 'Normalization',
        definition: 'Organizing database structure to reduce redundancy',
        difficulty: 'intermediate' as const,
        estimatedReadTime: 12,
        pageNumbers: [300, 301],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: [],
        sourceDocId: 'dbms-ramakrishnan-3rd-edition',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearConceptMapCache();
  });

  afterEach(() => {
    clearConceptMapCache();
  });

  it('loads a Murach concept via full namespaced key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDualMap),
    } as Response);

    const concept = await getConcept('murachs-mysql-3rd-edition/select-statement-murach');
    expect(concept).not.toBeNull();
    expect(concept?.title).toBe('SELECT Statement (Murach)');
    expect(concept?.sourceDocId).toBe('murachs-mysql-3rd-edition');
  });

  it('loads a Ramakrishnan concept via full namespaced key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDualMap),
    } as Response);

    const concept = await getConcept('dbms-ramakrishnan-3rd-edition/relational-model-intro');
    expect(concept).not.toBeNull();
    expect(concept?.title).toBe('Introduction to Relational Databases');
    expect(concept?.sourceDocId).toBe('dbms-ramakrishnan-3rd-edition');
  });

  it('loads Ramakrishnan concept markdown via namespaced file path', async () => {
    const mockMarkdown = `---
id: relational-model-intro
sourceDocId: dbms-ramakrishnan-3rd-edition
---

## Definition
Overview of database systems, relational model basics, and data independence

## Explanation
The relational model organizes data into tables (relations) with rows and columns.
`;

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDualMap),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockMarkdown),
      } as Response);

    const loaded = await loadConceptContent(
      'dbms-ramakrishnan-3rd-edition/relational-model-intro'
    );
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe('Introduction to Relational Databases');
    expect(loaded?.content.definition).toBe(
      'Overview of database systems, relational model basics, and data independence'
    );
  });

  it('resolveConceptId handles both textbooks without ambiguity in dual map', () => {
    const concepts = mockDualMap.concepts as Parameters<typeof resolveConceptId>[1];
    // Namespaced Murach key → exact match
    expect(resolveConceptId('murachs-mysql-3rd-edition/select-statement-murach', concepts))
      .toBe('murachs-mysql-3rd-edition/select-statement-murach');
    // Namespaced Ramakrishnan key → exact match
    expect(resolveConceptId('dbms-ramakrishnan-3rd-edition/relational-model-intro', concepts))
      .toBe('dbms-ramakrishnan-3rd-edition/relational-model-intro');
    // Plain suffix → unique resolution
    expect(resolveConceptId('normalization', concepts))
      .toBe('dbms-ramakrishnan-3rd-edition/normalization');
  });
});

describe('Murach corpus consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConceptMapCache();
  });

  afterEach(() => {
    clearConceptMapCache();
  });

  it('resolves representative Murach namespaced concept IDs from concept map', async () => {
    // Simulates a concept-map.json with the namespaced Murach format
    const mockMurachMap = {
      version: '1.0.0',
      generatedAt: '2026-03-15T21:08:18Z',
      sourceDocIds: ['murachs-mysql-3rd-edition'],
      concepts: {
        'murachs-mysql-3rd-edition/select-statement-murach': {
          id: 'murachs-mysql-3rd-edition/select-statement-murach',
          title: 'SELECT Statement (Murach)',
          definition: 'Retrieve rows from one or more tables',
          difficulty: 'beginner' as const,
          estimatedReadTime: 5,
          pageNumbers: [45],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: [],
          sourceDocId: 'murachs-mysql-3rd-edition'
        },
        'murachs-mysql-3rd-edition/joins-murach': {
          id: 'murachs-mysql-3rd-edition/joins-murach',
          title: 'JOIN Operations (Murach)',
          definition: 'Combine rows from multiple tables',
          difficulty: 'intermediate' as const,
          estimatedReadTime: 8,
          pageNumbers: [120],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: [],
          sourceDocId: 'murachs-mysql-3rd-edition'
        },
        'murachs-mysql-3rd-edition/group-by-murach': {
          id: 'murachs-mysql-3rd-edition/group-by-murach',
          title: 'GROUP BY (Murach)',
          definition: 'Group rows for aggregate calculations',
          difficulty: 'intermediate' as const,
          estimatedReadTime: 6,
          pageNumbers: [158],
          chunkIds: { definition: [], examples: [], commonMistakes: [] },
          relatedConcepts: [],
          practiceProblemIds: [],
          sourceDocId: 'murachs-mysql-3rd-edition'
        }
      }
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMurachMap)
    } as Response);

    // Plain ID should resolve to namespaced key via suffix match
    const concept = await getConcept('select-statement-murach');
    expect(concept).not.toBeNull();
    expect(concept?.title).toBe('SELECT Statement (Murach)');
    expect(concept?.sourceDocId).toBe('murachs-mysql-3rd-edition');
  });

  it('resolves all 33 Murach concept keys without ambiguity', () => {
    const murachKeys = [
      'murachs-mysql-3rd-edition/aggregate-functions-murach',
      'murachs-mysql-3rd-edition/alter-table-murach',
      'murachs-mysql-3rd-edition/backup-restore',
      'murachs-mysql-3rd-edition/constraints-murach',
      'murachs-mysql-3rd-edition/correlated-subquery-murach',
      'murachs-mysql-3rd-edition/create-table-murach',
      'murachs-mysql-3rd-edition/data-types-murach',
      'murachs-mysql-3rd-edition/date-functions',
      'murachs-mysql-3rd-edition/delete-murach',
      'murachs-mysql-3rd-edition/events',
      'murachs-mysql-3rd-edition/functions-murach',
      'murachs-mysql-3rd-edition/group-by-murach',
      'murachs-mysql-3rd-edition/having-murach',
      'murachs-mysql-3rd-edition/inner-join-murach',
      'murachs-mysql-3rd-edition/insert-murach',
      'murachs-mysql-3rd-edition/isolation-levels-murach',
      'murachs-mysql-3rd-edition/joins-murach',
      'murachs-mysql-3rd-edition/mysql-functions',
      'murachs-mysql-3rd-edition/mysql-intro',
      'murachs-mysql-3rd-edition/order-by-murach',
      'murachs-mysql-3rd-edition/outer-join-murach',
      'murachs-mysql-3rd-edition/relational-databases-murach',
      'murachs-mysql-3rd-edition/select-statement-murach',
      'murachs-mysql-3rd-edition/stored-procedures',
      'murachs-mysql-3rd-edition/string-functions',
      'murachs-mysql-3rd-edition/subqueries-murach',
      'murachs-mysql-3rd-edition/transactions-murach',
      'murachs-mysql-3rd-edition/triggers',
      'murachs-mysql-3rd-edition/unions',
      'murachs-mysql-3rd-edition/update-murach',
      'murachs-mysql-3rd-edition/user-management',
      'murachs-mysql-3rd-edition/views-murach',
      'murachs-mysql-3rd-edition/where-clause-murach'
    ];

    // Build a concepts map where every key is a Murach namespaced key
    const concepts: Record<string, ConceptInfo> = {};
    for (const key of murachKeys) {
      concepts[key] = {
        id: key,
        title: key.split('/').pop()!,
        definition: '',
        difficulty: 'beginner',
        estimatedReadTime: 5,
        pageNumbers: [],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: [],
        sourceDocId: 'murachs-mysql-3rd-edition'
      };
    }

    // Each key should resolve to itself (exact match)
    for (const key of murachKeys) {
      const resolved = resolveConceptId(key, concepts);
      expect(resolved).toBe(key);
    }

    // Each plain suffix should resolve uniquely back to the namespaced key
    for (const key of murachKeys) {
      const plainId = key.split('/').pop()!;
      const resolved = resolveConceptId(plainId, concepts);
      expect(resolved).toBe(key);
    }

    expect(murachKeys).toHaveLength(33);
  });
});

// ─── Compatibility-map regression: previously unresolved internal IDs ─────────
// These tests cover the 23 adaptive internal concept IDs that returned
// unresolved against the real 70-concept corpus before the compatibility layer
// was introduced.  The mock corpus uses actual corpus keys from concept-map.json.

describe('Compatibility-map resolution: previously unresolved internal IDs', () => {
  /**
   * Mock corpus that mirrors the real helper corpus keys relevant to the
   * adaptive concept IDs under test.  sourceDocId is set so markdown paths
   * are resolved correctly.
   */
  function makeEntry(key: string, title: string, difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'): ConceptInfo {
    const [sourceDocId, id] = key.includes('/') ? key.split('/') : ['', key];
    return {
      id: key,
      title,
      definition: `Definition of ${title}`,
      difficulty,
      estimatedReadTime: 5,
      pageNumbers: [1],
      chunkIds: { definition: [], examples: [], commonMistakes: [] },
      relatedConcepts: [],
      practiceProblemIds: [],
      sourceDocId: sourceDocId || undefined,
    };
  }

  // Subset of the real 70-concept corpus sufficient to cover every compatibility-map entry.
  const realCorpusConcepts: Record<string, ConceptInfo> = {
    'dbms-ramakrishnan-3rd-edition/select-basic': makeEntry('dbms-ramakrishnan-3rd-edition/select-basic', 'SELECT (Ramakrishnan)'),
    'murachs-mysql-3rd-edition/select-statement-murach': makeEntry('murachs-mysql-3rd-edition/select-statement-murach', 'SELECT Statement (Murach)'),
    'dbms-ramakrishnan-3rd-edition/selection-projection': makeEntry('dbms-ramakrishnan-3rd-edition/selection-projection', 'Selection and Projection'),
    'dbms-ramakrishnan-3rd-edition/where-clause': makeEntry('dbms-ramakrishnan-3rd-edition/where-clause', 'WHERE Clause (Ramakrishnan)'),
    'murachs-mysql-3rd-edition/where-clause-murach': makeEntry('murachs-mysql-3rd-edition/where-clause-murach', 'WHERE Clause (Murach)'),
    'dbms-ramakrishnan-3rd-edition/joins': makeEntry('dbms-ramakrishnan-3rd-edition/joins', 'Joins (Ramakrishnan)', 'intermediate'),
    'murachs-mysql-3rd-edition/joins-murach': makeEntry('murachs-mysql-3rd-edition/joins-murach', 'Joins (Murach)', 'intermediate'),
    'dbms-ramakrishnan-3rd-edition/inner-join': makeEntry('dbms-ramakrishnan-3rd-edition/inner-join', 'Inner Join', 'intermediate'),
    'dbms-ramakrishnan-3rd-edition/aggregate-functions': makeEntry('dbms-ramakrishnan-3rd-edition/aggregate-functions', 'Aggregate Functions', 'intermediate'),
    'murachs-mysql-3rd-edition/aggregate-functions-murach': makeEntry('murachs-mysql-3rd-edition/aggregate-functions-murach', 'Aggregate Functions (Murach)', 'intermediate'),
    'dbms-ramakrishnan-3rd-edition/group-by': makeEntry('dbms-ramakrishnan-3rd-edition/group-by', 'GROUP BY (Ramakrishnan)', 'intermediate'),
    'murachs-mysql-3rd-edition/group-by-murach': makeEntry('murachs-mysql-3rd-edition/group-by-murach', 'GROUP BY (Murach)', 'intermediate'),
    'dbms-ramakrishnan-3rd-edition/having': makeEntry('dbms-ramakrishnan-3rd-edition/having', 'HAVING (Ramakrishnan)', 'intermediate'),
    'murachs-mysql-3rd-edition/having-murach': makeEntry('murachs-mysql-3rd-edition/having-murach', 'HAVING (Murach)', 'intermediate'),
    'murachs-mysql-3rd-edition/string-functions': makeEntry('murachs-mysql-3rd-edition/string-functions', 'String Functions'),
    'murachs-mysql-3rd-edition/date-functions': makeEntry('murachs-mysql-3rd-edition/date-functions', 'Date Functions'),
    'murachs-mysql-3rd-edition/mysql-functions': makeEntry('murachs-mysql-3rd-edition/mysql-functions', 'MySQL Functions'),
    'murachs-mysql-3rd-edition/functions-murach': makeEntry('murachs-mysql-3rd-edition/functions-murach', 'Functions (Murach)'),
    'murachs-mysql-3rd-edition/order-by-murach': makeEntry('murachs-mysql-3rd-edition/order-by-murach', 'ORDER BY (Murach)'),
    'dbms-ramakrishnan-3rd-edition/subqueries': makeEntry('dbms-ramakrishnan-3rd-edition/subqueries', 'Subqueries (Ramakrishnan)', 'advanced'),
    'murachs-mysql-3rd-edition/subqueries-murach': makeEntry('murachs-mysql-3rd-edition/subqueries-murach', 'Subqueries (Murach)', 'advanced'),
    'dbms-ramakrishnan-3rd-edition/correlated-subquery': makeEntry('dbms-ramakrishnan-3rd-edition/correlated-subquery', 'Correlated Subquery', 'advanced'),
    'dbms-ramakrishnan-3rd-edition/set-operations': makeEntry('dbms-ramakrishnan-3rd-edition/set-operations', 'Set Operations', 'advanced'),
    'murachs-mysql-3rd-edition/unions': makeEntry('murachs-mysql-3rd-edition/unions', 'UNION (Murach)', 'advanced'),
    'dbms-ramakrishnan-3rd-edition/sql-intro': makeEntry('dbms-ramakrishnan-3rd-edition/sql-intro', 'Introduction to SQL'),
    'murachs-mysql-3rd-edition/mysql-intro': makeEntry('murachs-mysql-3rd-edition/mysql-intro', 'Introduction to MySQL'),
  };

  it('resolves "joins" to dbms-ramakrishnan-3rd-edition/joins (previously unresolved)', () => {
    const result = resolveConceptId('joins', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/joins');
  });

  it('resolves "logical-operators" to dbms-ramakrishnan-3rd-edition/where-clause via compatibility map', () => {
    const result = resolveConceptId('logical-operators', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/where-clause');
  });

  it('resolves "order-by" to murachs-mysql-3rd-edition/order-by-murach via compatibility map', () => {
    const result = resolveConceptId('order-by', realCorpusConcepts);
    expect(result).toBe('murachs-mysql-3rd-edition/order-by-murach');
  });

  it('resolves "having-clause" to dbms-ramakrishnan-3rd-edition/having via compatibility map', () => {
    const result = resolveConceptId('having-clause', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/having');
  });

  it('resolves "aggregation" to dbms-ramakrishnan-3rd-edition/aggregate-functions via compatibility map', () => {
    const result = resolveConceptId('aggregation', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/aggregate-functions');
  });

  it('resolves "null-handling" to dbms-ramakrishnan-3rd-edition/where-clause via compatibility map', () => {
    const result = resolveConceptId('null-handling', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/where-clause');
  });

  it('resolves "group-by-error" to dbms-ramakrishnan-3rd-edition/group-by via compatibility map', () => {
    const result = resolveConceptId('group-by-error', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/group-by');
  });

  it('resolves "union" to dbms-ramakrishnan-3rd-edition/set-operations via compatibility map', () => {
    const result = resolveConceptId('union', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/set-operations');
  });

  it('resolves "syntax-error" to dbms-ramakrishnan-3rd-edition/sql-intro via compatibility map', () => {
    const result = resolveConceptId('syntax-error', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/sql-intro');
  });

  it('resolves "exist-clause" to dbms-ramakrishnan-3rd-edition/subqueries via compatibility map', () => {
    const result = resolveConceptId('exist-clause', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/subqueries');
  });

  it('resolves "join-condition-missing" to dbms-ramakrishnan-3rd-edition/joins via compatibility map', () => {
    const result = resolveConceptId('join-condition-missing', realCorpusConcepts);
    expect(result).toBe('dbms-ramakrishnan-3rd-edition/joins');
  });

  it('getCompatibleCorpusIds returns all available candidates for "joins"', () => {
    const ids = getCompatibleCorpusIds('joins', realCorpusConcepts);
    expect(ids).toContain('dbms-ramakrishnan-3rd-edition/joins');
    expect(ids).toContain('murachs-mysql-3rd-edition/joins-murach');
    expect(ids[0]).toBe('dbms-ramakrishnan-3rd-edition/joins'); // Preferred first
  });

  it('getCompatibleCorpusIds returns only existing candidates (filters missing)', () => {
    // A corpus with only Murach joins
    const murachOnly: Record<string, ConceptInfo> = {
      'murachs-mysql-3rd-edition/joins-murach': makeEntry('murachs-mysql-3rd-edition/joins-murach', 'Joins (Murach)', 'intermediate'),
    };
    const ids = getCompatibleCorpusIds('joins', murachOnly);
    expect(ids).toEqual(['murachs-mysql-3rd-edition/joins-murach']);
  });

  it('all 30 internal concept-graph IDs resolve to a corpus entry in the mock real corpus', () => {
    const internalIds = [
      'select-basic', 'distinct', 'alias',
      'where-clause', 'logical-operators', 'null-handling', 'in-operator', 'between-operator', 'like-pattern',
      'joins', 'join-condition-missing', 'ambiguous-column', 'self-join', 'cross-join',
      'aggregation', 'group-by', 'group-by-error', 'having-clause',
      'string-functions', 'date-functions', 'case-expression',
      'order-by', 'limit-offset',
      'subqueries', 'exist-clause', 'union', 'cte', 'window-functions',
      'syntax-error', 'missing-from',
    ];

    const unresolved: string[] = [];
    for (const id of internalIds) {
      const resolved = resolveConceptId(id, realCorpusConcepts);
      if (!realCorpusConcepts[resolved]) {
        unresolved.push(id);
      }
    }

    expect(
      unresolved,
      `These internal IDs did not resolve to a corpus entry:\n  ${unresolved.join('\n  ')}`
    ).toHaveLength(0);
  });
});
