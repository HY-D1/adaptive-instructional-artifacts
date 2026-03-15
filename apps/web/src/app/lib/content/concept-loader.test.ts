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
