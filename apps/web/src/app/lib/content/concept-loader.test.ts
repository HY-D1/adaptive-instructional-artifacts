import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  resolveConceptId, 
  getConcept, 
  loadConceptContent,
  clearConceptMapCache,
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
