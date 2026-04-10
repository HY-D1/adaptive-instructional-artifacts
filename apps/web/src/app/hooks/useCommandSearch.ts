import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadConceptMap, type ConceptInfo } from '../lib/content/concept-loader';
import { safeSet } from '../lib/storage/safe-storage';
import { sqlProblems } from '../data/problems';
import type { SQLProblem } from '../types';

export interface SearchItem {
  id: string;
  type: 'concept' | 'problem' | 'page';
  title: string;
  description?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  url: string;
  keywords: string[];
}

interface UseCommandSearchOptions {
  maxResults?: number;
}

// Static page definitions
const STATIC_PAGES: SearchItem[] = [
  {
    id: 'page-textbook',
    type: 'page',
    title: 'My Textbook',
    description: 'View your personalized adaptive textbook',
    url: '/textbook',
    keywords: ['textbook', 'notes', 'personal', 'adaptive', 'learning'],
  },
  {
    id: 'page-concepts',
    type: 'page',
    title: 'Concept Library',
    description: 'Browse all SQL concepts and topics',
    url: '/concepts',
    keywords: ['concepts', 'library', 'topics', 'learn', 'study'],
  },
  {
    id: 'page-practice',
    type: 'page',
    title: 'Practice Problems',
    description: 'Practice SQL with interactive problems',
    url: '/practice',
    keywords: ['practice', 'problems', 'exercises', 'sql', 'coding'],
  },
  {
    id: 'page-research',
    type: 'page',
    title: 'Research Dashboard',
    description: 'View learning analytics and research data',
    url: '/research',
    keywords: ['research', 'analytics', 'dashboard', 'stats', 'progress'],
  },
  {
    id: 'page-settings',
    type: 'page',
    title: 'Settings',
    description: 'Configure your learning preferences',
    url: '/settings',
    keywords: ['settings', 'preferences', 'config', 'options'],
  },
];

// Recent searches storage key
const RECENT_SEARCHES_KEY = 'sqladapt:recent-searches';
const MAX_RECENT_SEARCHES = 5;

export function useCommandSearch(options: UseCommandSearchOptions = {}) {
  const { maxResults = 20 } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [concepts, setConcepts] = useState<ConceptInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<SearchItem[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchItem[];
        setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((item: SearchItem) => {
    try {
      setRecentSearches((prev) => {
        const filtered = prev.filter((s) => s.id !== item.id);
        const updated = [item, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        safeSet(RECENT_SEARCHES_KEY, updated, { priority: 'cache' });
        return updated;
      });
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Load concepts on mount
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const map = await loadConceptMap();
        if (mounted && map) {
          setConcepts(Object.values(map.concepts));
        }
      } catch (error) {
        console.error('[useCommandSearch] Failed to load concepts:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // Convert concepts to search items
  const conceptItems: SearchItem[] = useMemo(() => {
    return concepts.map((concept) => ({
      id: `concept-${concept.id}`,
      type: 'concept',
      title: concept.title,
      description: concept.definition?.slice(0, 100) + (concept.definition?.length > 100 ? '...' : ''),
      difficulty: concept.difficulty,
      url: `/concepts/${concept.id}`,
      keywords: [
        concept.id,
        concept.title,
        ...(concept.relatedConcepts || []),
      ].filter(Boolean),
    }));
  }, [concepts]);

  // Convert problems to search items
  const problemItems: SearchItem[] = useMemo(() => {
    return sqlProblems.map((problem: SQLProblem) => ({
      id: `problem-${problem.id}`,
      type: 'problem',
      title: problem.title,
      description: problem.description?.slice(0, 100) + (problem.description?.length > 100 ? '...' : ''),
      difficulty: problem.difficulty as 'beginner' | 'intermediate' | 'advanced',
      url: `/practice/${problem.id}`,
      keywords: [
        problem.id,
        problem.title,
        ...(problem.concepts || []),
      ].filter(Boolean),
    }));
  }, []);

  // All searchable items
  const allItems: SearchItem[] = useMemo(() => {
    return [...STATIC_PAGES, ...conceptItems, ...problemItems];
  }, [conceptItems, problemItems]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return [];
    }

    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);

    const scored = allItems.map((item) => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const descLower = item.description?.toLowerCase() || '';
      const keywordsLower = item.keywords.map((k) => k.toLowerCase());

      // Exact title match (highest priority)
      if (titleLower === normalizedQuery) {
        score += 100;
      }
      // Title starts with query
      else if (titleLower.startsWith(normalizedQuery)) {
        score += 80;
      }
      // Title contains query
      else if (titleLower.includes(normalizedQuery)) {
        score += 60;
      }

      // All query words match in title
      if (queryWords.every((word) => titleLower.includes(word))) {
        score += 40;
      }

      // Keyword matches
      for (const keyword of keywordsLower) {
        if (keyword === normalizedQuery) {
          score += 50;
        } else if (keyword.startsWith(normalizedQuery)) {
          score += 30;
        } else if (keyword.includes(normalizedQuery)) {
          score += 20;
        }
      }

      // Description match
      if (descLower.includes(normalizedQuery)) {
        score += 10;
      }

      // Type priority bonus
      if (item.type === 'concept' && queryWords.some((w) => ['concept', 'topic', 'learn'].includes(w))) {
        score += 5;
      }
      if (item.type === 'problem' && queryWords.some((w) => ['problem', 'practice', 'exercise'].includes(w))) {
        score += 5;
      }

      return { item, score };
    });

    // Filter out zero scores and sort by score descending
    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ item }) => item);
  }, [allItems, query, maxResults]);

  // Group results by type
  const groupedResults = useMemo(() => {
    if (!query.trim()) {
      return null;
    }

    const groups: Record<string, SearchItem[]> = {
      concepts: [],
      problems: [],
      pages: [],
    };

    for (const item of filteredItems) {
      if (item.type === 'concept') groups.concepts.push(item);
      else if (item.type === 'problem') groups.problems.push(item);
      else if (item.type === 'page') groups.pages.push(item);
    }

    return groups;
  }, [filteredItems, query]);

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openMenu = useCallback(() => setIsOpen(true), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    openMenu,
    closeMenu,
    query,
    setQuery,
    isLoading,
    recentSearches,
    filteredItems,
    groupedResults,
    saveRecentSearch,
    allItems,
  };
}
