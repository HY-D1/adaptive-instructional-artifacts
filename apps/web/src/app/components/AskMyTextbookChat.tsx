/**
 * Ask My Textbook Chat Component (Week 3 Feature)
 * 
 * A chat panel in the sidebar for grounded Q&A with textbook content.
 * - Each user message gets a grounded response
 * - "Save to My Notes" button for each response
 * - Quick chips for common queries
 * - Logs chat_interaction events with retrievedSourceIds
 * - Auto-saves high-quality responses to My Textbook
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  MessageCircle, 
  Send, 
  BookOpen, 
  Save, 
  Lightbulb,
  AlertCircle,
  Code,
  HelpCircle,
  Hash,
  X,
  CheckCircle
} from 'lucide-react';
// Note: Using div with overflow-auto instead of ScrollArea
import { cn } from './ui/utils';
import { storage } from '../lib/storage';
import { createEventId } from '../lib/event-id';
import type { InteractionEvent, InstructionalUnit } from '../types';
import { buildRetrievalBundle } from '../lib/retrieval-bundle';
import { getProblemById } from '../data/problems';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  retrievedSourceIds?: string[];
  textbookUnitIds?: string[];
  savedToNotes?: boolean;
  autoSaved?: boolean;
  quickChip?: string;
  sources?: Array<{id: string; title: string; type: 'unit' | 'pdf'}>;
  queryHash?: string; // For duplicate detection
};

/**
 * Props for AskMyTextbookChat component
 */
interface AskMyTextbookChatProps {
  /** Session identifier */
  sessionId?: string;
  /** Learner identifier */
  learnerId: string;
  /** Current problem ID */
  problemId: string;
  /** Recent interactions for context */
  recentInteractions: InteractionEvent[];
  /** Callback when interaction is logged */
  onInteractionLogged?: (event: InteractionEvent) => void;
}

// Quick chip options
const QUICK_CHIPS = [
  { id: 'explain_error', label: 'Explain my last error', icon: AlertCircle },
  { id: 'minimal_example', label: 'Show a minimal example', icon: Code },
  { id: 'what_concept', label: 'What concept is this?', icon: HelpCircle },
  { id: 'hint_response', label: 'Give me a hint', icon: Lightbulb },
] as const;

// Quality threshold for auto-save
const QUALITY_THRESHOLD = 0.7;
const MIN_CONTENT_LENGTH = 100;
const MIN_SOURCE_COUNT = 2;

// Timing constants (ms)
const TOAST_DURATION_MS = 3000;
const PROCESSING_DELAY_MS = 500;
const AUTO_SAVE_DELAY_MS = 100;

// Content limits
const MAX_SQL_EXAMPLE_LENGTH = 200;
const MAX_RESPONSE_PREVIEW_LENGTH = 400;
const MAX_PDF_TEXT_LENGTH = 350;

// Toast notification type
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info';
}

/**
 * Ask My Textbook Chat Component (Week 3 Feature)
 * 
 * A chat panel for grounded Q&A with textbook content.
 * Features:
 * - Grounded responses using retrieval bundle
 * - "Save to My Notes" button
 * - Quick chips for common queries
 * - Chat interaction logging
 * - Auto-save for high-quality responses
 * 
 * @param props - Component props
 * @returns Chat panel JSX
 */
export function AskMyTextbookChat({
  sessionId,
  learnerId,
  problemId,
  recentInteractions,
  onInteractionLogged
}: AskMyTextbookChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track toast timeout IDs for cleanup on unmount
  const toastTimeoutsRef = useRef<Set<number>>(new Set());

  // Track auto-saved queries to prevent duplicates
  const autoSavedQueriesRef = useRef<Set<string>>(new Set());

  // Get textbook units for grounding
  const getTextbookUnits = useCallback((): InstructionalUnit[] => {
    return storage.getTextbook(learnerId);
  }, [learnerId]);

  // Get all interactions from storage to persist across page navigation
  const getStoredInteractions = useCallback((): InteractionEvent[] => {
    return storage.getInteractionsByLearner(learnerId);
  }, [learnerId]);

  // Build retrieval bundle for grounding - prioritizes current problem context
  const buildGroundingPayload = useCallback((query: string, quickChip?: string) => {
    const problem = getProblemById(problemId);
    const textbookUnits = getTextbookUnits();
    
    // Get current problem's concepts
    const problemConceptIds = problem?.concepts || [];
    
    // Get interactions from storage (persists across page navigation)
    // Fall back to recentInteractions prop if storage is empty
    const storedInteractions = getStoredInteractions();
    const allInteractions = storedInteractions.length > 0 
      ? storedInteractions 
      : recentInteractions;
    
    // Get the last error subtype for context (includes failed executions)
    const lastError = [...allInteractions]
      .reverse()
      .find(i => i.eventType === 'error' || 
                 (i.eventType === 'execution' && i.successful === false));
    const errorSubtype = lastError?.sqlEngageSubtype || 
                        lastError?.errorSubtypeId ||
                        (lastError?.successful === false ? 'incorrect_results' : undefined);
    
    // Filter units by problem concepts FIRST (most relevant)
    let relevantUnits = textbookUnits.filter(unit => 
      problemConceptIds.length === 0 || 
      problemConceptIds.some(pc => unit.conceptId === pc || unit.conceptIds?.includes(pc))
    );
    
    // If no concept match, filter by query keywords
    if (relevantUnits.length === 0) {
      relevantUnits = textbookUnits.filter(unit => {
        const searchText = `${unit.title} ${unit.content} ${unit.conceptId}`.toLowerCase();
        const queryTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
        return queryTerms.some(term => searchText.includes(term));
      });
    }
    
    // Sort by relevance: units matching error subtype come first
    if (errorSubtype) {
      relevantUnits.sort((a, b) => {
        const aMatchesError = (a.title + a.content).toLowerCase().includes(errorSubtype.toLowerCase());
        const bMatchesError = (b.title + b.content).toLowerCase().includes(errorSubtype.toLowerCase());
        return Number(bMatchesError) - Number(aMatchesError);
      });
    }
    
    // Take top 2 most relevant units (reduce clutter)
    relevantUnits = relevantUnits.slice(0, 2);

    // Build retrieval bundle with PDF sources for THIS problem
    let bundleSources: string[] = [];
    let pdfPassages: Array<{docId: string; page: number; text: string}> = [];
    
    if (problem) {
      try {
        const bundle = buildRetrievalBundle({
          learnerId,
          problem,
          interactions: recentInteractions,
          lastErrorSubtypeId: errorSubtype,
          pdfTopK: 2  // Reduce to top 2 most relevant passages
        });
        
        // Filter bundle sources to only most relevant ones matching error subtype
        bundleSources = bundle.retrievedSourceIds.filter(id => {
          // Keep SQL-Engage sources that match error subtype
          if (id.includes('sql-engage') && errorSubtype) {
            return true; // Keep all SQL-Engage matches
          }
          // Keep PDF sources (limited below)
          return id.includes('doc-');
        }).slice(0, 3); // Max 3 bundle sources
        
        pdfPassages = bundle.pdfPassages
          .map(p => ({
            docId: p.docId,
            page: p.page,
            text: cleanText(p.text)
          }))
          .filter(p => {
            // Must be substantial content
            if (p.text.length < 100) return false;
            // Prefer content matching error subtype
            if (errorSubtype) {
              const textLower = p.text.toLowerCase();
              const errorLower = errorSubtype.toLowerCase();
              return textLower.includes(errorLower) || 
                     textLower.includes(errorLower.replace(/_/g, ' '));
            }
            return true;
          })
          .slice(0, 2); // Max 2 PDF passages
      } catch {
        // Bundle building failed
      }
    }

    // Build curated source list - MAX 5 total for display
    const curatedSourceIds = [
      ...relevantUnits.map(u => u.id),
      ...bundleSources
    ].slice(0, 5);

    return {
      relevantUnits,
      bundleSources,
      pdfPassages,
      allSourceIds: curatedSourceIds, // Only return curated list
      problemConceptIds,
      errorSubtype
    };
  }, [learnerId, problemId, recentInteractions, getTextbookUnits, getStoredInteractions]);

  // Clean up text for better readability - more aggressive cleaning
  const cleanText = useCallback((text: string): string => {
    return text
      .replace(/_/g, '')
      .replace(/@\w+/g, '')  // Remove @variables
      .replace(/\/\/\s*/g, '')  // Remove // comments
      .replace(/END\/\//gi, '')  // Remove END//
      .replace(/DEALLOCATE\s+PREPARE[^;]*/gi, '')  // Remove DEALLOCATE statements
      .replace(/EXECUTE[^;]*/gi, '')  // Remove EXECUTE statements
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/Figure \d+-\d+[^.]*/gi, '')
      .replace(/Description\s*•/gi, '')
      .trim();
  }, []);
  
  // Extract a clean SQL example from text
  const extractSqlExample = useCallback((text: string): string | null => {
    // Look for SELECT statements
    const selectMatch = text.match(/SELECT\s+.+?FROM\s+\w+[^;]*/i);
    if (selectMatch) {
      let sql = selectMatch[0]
        .replace(/@\w+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      // Limit length
      if (sql.length > MAX_SQL_EXAMPLE_LENGTH) {
        sql = sql.substring(0, MAX_SQL_EXAMPLE_LENGTH) + '...';
      }
      return sql;
    }
    return null;
  }, []);
  
  // Get actionable fix based on error subtype
  const getActionableFix = useCallback((errorSubtype: string): string => {
    const fixes: Record<string, string> = {
      'incomplete_query': 'Your query is missing the FROM clause. Try: SELECT column_name FROM table_name;',
      'missing_from': 'Add FROM followed by the table name: SELECT * FROM your_table;',
      'missing_where': 'If you need to filter, add WHERE: SELECT * FROM table WHERE condition;',
      'syntax_error': 'Check for missing commas, quotes, or semicolons at the end.',
      'unknown_column': 'Check the column name spelling. Use DESC table_name to see available columns.',
      'unknown_table': 'Check the table name. Use SHOW TABLES to see available tables.',
      'unmatched_parenthesis': 'Count your opening ( and closing ) parentheses - they must match.',
      'missing_select': 'Start with SELECT: SELECT column_name FROM table_name;',
    };
    return fixes[errorSubtype.toLowerCase()] || 
           fixes[errorSubtype.toLowerCase().replace(/_/g, ' ')] || 
           'Check your query syntax carefully. Start with SELECT, then column names, then FROM table_name;';
  }, []);

  // Calculate quality score for auto-save
  const calculateQuality = useCallback((
    response: string,
    sources: Array<{id: string; title: string; type: 'unit' | 'pdf'}>,
    quickChip?: string
  ): number => {
    let score = 0;
    
    // Source count factor (0-0.4)
    const sourceCount = sources?.length || 0;
    if (sourceCount >= MIN_SOURCE_COUNT) {
      score += 0.4;
    } else if (sourceCount === 1) {
      score += 0.2;
    }
    
    // Content length factor (0-0.4)
    const contentLength = response?.length || 0;
    if (contentLength > 200) {
      score += 0.4;
    } else if (contentLength > MIN_CONTENT_LENGTH) {
      score += 0.3;
    } else if (contentLength > 50) {
      score += 0.1;
    }
    
    // Quick chip bonus for known high-value types (0-0.2)
    if (quickChip === 'explain_error' || quickChip === 'minimal_example') {
      score += 0.2;
    } else if (quickChip === 'what_concept' || quickChip === 'hint_response') {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }, []);

  // Generate a hash for the query to track duplicates
  const generateQueryHash = useCallback((query: string, quickChip?: string): string => {
    const normalized = (quickChip || query).toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `query-${hash}`;
  }, []);

  // Check if query already has an auto-saved unit
  const hasExistingUnitForQuery = useCallback((queryHash: string): boolean => {
    const existingUnits = storage.getTextbook(learnerId);
    return existingUnits.some(unit => 
      unit.sourceInteractionIds?.some(id => id.includes(queryHash)) ||
      unit.createdFromInteractionIds?.some(id => id.includes(queryHash))
    );
  }, [learnerId]);

  // Create instructional unit from chat response
  const createUnitFromChatResponse = useCallback((
    response: string,
    sources: Array<{id: string; title: string; type: 'unit' | 'pdf'}>,
    problemConceptIds: string[],
    queryHash: string,
    quickChip?: string
  ): InstructionalUnit => {
    const now = Date.now();
    const conceptId = problemConceptIds[0] || 'general';
    const conceptIds = problemConceptIds.length > 0 ? problemConceptIds : [conceptId];
    
    // Generate title based on quick chip or content
    let title: string;
    if (quickChip === 'explain_error') {
      title = 'Error Explanation';
    } else if (quickChip === 'minimal_example') {
      title = 'SQL Example';
    } else if (quickChip === 'what_concept') {
      title = 'Concept Overview';
    } else if (quickChip === 'hint_response') {
      title = 'Hint & Guidance';
    } else {
      title = `Chat Response - ${new Date(now).toLocaleDateString()}`;
    }
    
    return {
      id: createEventId('unit-chat'),
      type: 'summary',
      conceptId,
      conceptIds,
      title,
      content: response,
      prerequisites: [],
      addedTimestamp: now,
      sourceInteractionIds: [queryHash],
      createdFromInteractionIds: [queryHash],
      sourceRefIds: sources.map(s => s.id),
      revisionCount: 0
    };
  }, []);

  // Cleanup toast timeouts on unmount
  // NOTE: This cleanup effect is intentionally separate from toast creation to avoid
  // re-running cleanup on every toast state change. All timeouts are tracked in
  // toastTimeoutsRef for centralized cleanup on unmount only.
  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  // Show toast notification
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const toast: Toast = {
      id: createEventId('toast'),
      message,
      type
    };
    setToasts(prev => [...prev, toast]);
    
    // Auto-dismiss after toast duration
    const timeoutId = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
      toastTimeoutsRef.current.delete(timeoutId);
    }, TOAST_DURATION_MS);
    toastTimeoutsRef.current.add(timeoutId);
  }, []);

  // Log textbook_add event for auto-save
  const logTextbookAddEvent = useCallback((
    unitId: string,
    conceptIds: string[],
    sourceIds: string[],
    queryHash: string
  ) => {
    if (!sessionId) return;

    const event: InteractionEvent = {
      id: createEventId('textbook-add-auto'),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'textbook_add',
      problemId,
      unitId,
      conceptIds,
      retrievedSourceIds: sourceIds,
      triggerInteractionIds: [queryHash],
      evidenceInteractionIds: [queryHash],
      sourceInteractionIds: [queryHash],
      noteTitle: 'Auto-saved from chat',
      noteContent: `Auto-saved response for query hash ${queryHash}`
    };

    storage.saveInteraction(event);
    onInteractionLogged?.(event);
  }, [sessionId, learnerId, problemId, onInteractionLogged]);

  // Auto-save high-quality response to textbook
  const autoSaveToTextbook = useCallback((
    message: ChatMessage,
    problemConceptIds: string[]
  ): boolean => {
    if (!message.sources || message.sources.length === 0) return false;
    
    const queryHash = message.queryHash || generateQueryHash(message.content, message.quickChip);
    
    // Check if already auto-saved this query
    if (autoSavedQueriesRef.current.has(queryHash)) {
      return false;
    }
    
    // Check for existing unit
    if (hasExistingUnitForQuery(queryHash)) {
      autoSavedQueriesRef.current.add(queryHash);
      return false;
    }
    
    // Calculate quality score
    const quality = calculateQuality(message.content, message.sources, message.quickChip);
    
    if (quality >= QUALITY_THRESHOLD) {
      const unit = createUnitFromChatResponse(
        message.content,
        message.sources,
        problemConceptIds,
        queryHash,
        message.quickChip
      );
      
      const result = storage.saveTextbookUnit(learnerId, unit);
      
      if (result.success) {
        // Track this query as auto-saved
        autoSavedQueriesRef.current.add(queryHash);
        
        // Log the auto-save event
        logTextbookAddEvent(
          unit.id,
          unit.conceptIds || [unit.conceptId],
          message.retrievedSourceIds || [],
          queryHash
        );
        
        // Update message state to show auto-saved indicator
        setMessages(prev => prev.map(m => 
          m.id === message.id ? { ...m, autoSaved: true, queryHash } : m
        ));
        
        // Show toast
        showToast('Saved to My Textbook', 'success');
        
        return true;
      }
    }
    
    return false;
  }, [
    learnerId,
    calculateQuality,
    createUnitFromChatResponse,
    hasExistingUnitForQuery,
    generateQueryHash,
    logTextbookAddEvent,
    showToast
  ]);

  // Generate grounded response using retrieved sources - FOCUSED & ACTIONABLE
  const generateResponse = useCallback((query: string, quickChip?: string): { 
    response: string; 
    sourceIds: string[];
    unitIds: string[];
    sources: Array<{id: string; title: string; type: 'unit' | 'pdf'}>;
    problemConceptIds: string[];
  } => {
    const { 
      relevantUnits, 
      bundleSources, 
      pdfPassages,
      allSourceIds,
      problemConceptIds,
      errorSubtype
    } = buildGroundingPayload(query, quickChip);
    
    // Build source list for display - DEDUPLICATE by normalized title
    const seenTitles = new Set<string>();
    const sources = [
      ...relevantUnits.map(u => ({ 
        id: u.id, 
        title: u.title?.trim() || 'Untitled', 
        type: 'unit' as const 
      })),
      ...bundleSources
        .filter(id => id.includes('doc-'))  // Only show PDF docs, not all SQL-Engage IDs
        .map(id => ({ 
          id, 
          title: `Textbook ${id.match(/p\d+/)?.[0] || ''}`, 
          type: 'pdf' as const 
        }))
    ].filter(s => {
      const normalizedTitle = s.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) return false;
      seenTitles.add(normalizedTitle);
      return true;
    }).slice(0, 4); // MAX 4 sources displayed
    
    // Generate response based on quick chip or query
    let response = '';
    
    if (quickChip === 'explain_error') {
      // Get interactions from storage (persists across page navigation)
      const storedInteractions = getStoredInteractions();
      const allInteractions = storedInteractions.length > 0 
        ? storedInteractions 
        : recentInteractions;
      
      // Find last error OR failed execution (wrong results)
      const lastError = [...allInteractions]
        .reverse()
        .find(i => i.eventType === 'error' || 
                   (i.eventType === 'execution' && i.successful === false));
      
      if (lastError) {
        // Determine error type and message
        const errorType = lastError.errorSubtypeId || 
                         lastError.sqlEngageSubtype || 
                         (lastError.successful === false ? 'incorrect_results' : 'unknown');
        
        const errorMessage = lastError.error || 
                            (lastError.successful === false ? 'Query returned wrong results' : 'Unknown error');
        
        // ACTIONABLE fix first
        if (errorType !== 'unknown' && errorType !== 'incorrect_results') {
          response = `**Fix:** ${getActionableFix(errorType)}\n\n`;
        } else if (lastError.successful === false) {
          // Wrong results - give specific guidance
          response = `**Issue:** Your query ran but returned incorrect results.\n\n`;
          response += `**Check:**\n`;
          response += `• Did you select all required columns?\n`;
          response += `• Is your WHERE clause too restrictive?\n`;
          response += `• Are you filtering out rows that should be included?\n\n`;
        } else {
          response = `**Error:** ${errorMessage}\n\n`;
        }
        
        // Add context from PDF if relevant and short
        if (pdfPassages.length > 0) {
          const relevantText = pdfPassages[0].text.substring(0, 250);
          if (relevantText.length > 50) {
            response += `**From your textbook:** ${relevantText}...\n\n`;
          }
        }
        
        // Add unit reference if available
        if (relevantUnits.length > 0) {
          response += `📚 See "${relevantUnits[0].title}" in your textbook.`;
        }
      } else {
        response = 'No recent errors found. Try running a query first!';
      }
    } else if (quickChip === 'minimal_example') {
      // Try to find a clean SQL example
      let example: string | null = null;
      
      // Check PDF passages for SELECT examples
      for (const passage of pdfPassages) {
        example = extractSqlExample(passage.text);
        if (example) break;
      }
      
      // Check units for minimalExample
      if (!example) {
        const unitWithExample = relevantUnits.find(u => u.minimalExample);
        if (unitWithExample?.minimalExample) {
          example = cleanText(unitWithExample.minimalExample);
        }
      }
      
      if (example) {
        response = `**Try this pattern:**\n\n\`\`\`sql\n${example}\n\`\`\`\n\nAdapt the column and table names to your problem.`;
      } else {
        response = `**Basic pattern:**\n\n\`\`\`sql\nSELECT column_name\nFROM table_name\nWHERE condition;\n\`\`\`\n\nReplace with your actual columns, table, and filter.`;
      }
    } else if (quickChip === 'what_concept') {
      const problem = getProblemById(problemId);
      if (problem?.concepts.length || problemConceptIds.length) {
        const concepts = problem?.concepts || problemConceptIds;
        response = `**Key concept${concepts.length > 1 ? 's' : ''}:** ${concepts.join(', ')}\n\n`;
        
        if (relevantUnits.length) {
          response += `**Review:** "${relevantUnits[0].title}"\n\n`;
          if (relevantUnits[0].summary) {
            response += cleanText(relevantUnits[0].summary).substring(0, 200);
          }
        } else {
          response += 'Focus on which table has the data you need and what columns to select.';
        }
      } else {
        response = 'This problem tests SQL SELECT basics. Identify the table, then pick the right columns.';
      }
    } else if (quickChip === 'hint_response') {
      // Get the most practical hint
      const unit = relevantUnits[0];
      
      if (unit?.commonMistakes?.length) {
        response = `**Common mistake:** ${unit.commonMistakes[0]}\n\n**Try:** ${getActionableFix(errorSubtype || 'syntax_error')}`;
      } else if (unit?.summary) {
        const summary = cleanText(unit.summary);
        response = `**Hint:** ${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}`;
      } else if (errorSubtype) {
        response = `**Hint:** ${getActionableFix(errorSubtype)}`;
      } else {
        response = '**Hint:** Break it down: 1) Which table? 2) Which columns? 3) Any filters needed?';
      }
    } else {
      // Custom query - concise answer
      const unitContent = relevantUnits[0];
      
      if (unitContent) {
        const content = cleanText(unitContent.summary || unitContent.content || '');
        response = content.substring(0, MAX_RESPONSE_PREVIEW_LENGTH);
        if (content.length > MAX_RESPONSE_PREVIEW_LENGTH) response += '...';
      } else if (pdfPassages.length > 0) {
        response = pdfPassages[0].text.substring(0, MAX_PDF_TEXT_LENGTH) + '...';
      } else {
        response = 'I don\'t have specific notes on that yet. Try the quick chips above for common questions.';
      }
    }

    return {
      response,
      sourceIds: allSourceIds,
      unitIds: relevantUnits.map(u => u.id),
      sources,
      problemConceptIds
    };
  }, [buildGroundingPayload, recentInteractions, problemId, cleanText, extractSqlExample, getActionableFix]);

  // Log chat interaction
  const logChatInteraction = useCallback((
    message: string,
    response: string,
    sourceIds: string[],
    quickChip?: string,
    savedToNotes?: boolean
  ) => {
    if (!sessionId) return;

    const event: InteractionEvent = {
      id: createEventId('chat'),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'chat_interaction',
      problemId,
      chatMessage: message,
      chatResponse: response,
      chatQuickChip: quickChip,
      savedToNotes,
      retrievedSourceIds: sourceIds,
      textbookUnitsRetrieved: sourceIds.filter(id => id.startsWith('unit-') || !id.includes(':'))
    };

    storage.saveInteraction(event);
    onInteractionLogged?.(event);
  }, [sessionId, learnerId, problemId, onInteractionLogged]);

  // Handle sending message
  const handleSend = useCallback(async (quickChip?: string) => {
    const messageText = quickChip 
      ? QUICK_CHIPS.find(c => c.id === quickChip)?.label || quickChip
      : inputValue.trim();
    
    if (!messageText || !sessionId) return;

    // Generate query hash for duplicate detection
    const queryHash = generateQueryHash(messageText, quickChip);

    // Add user message
    const userMessage: ChatMessage = {
      id: createEventId('chat-msg'),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      quickChip,
      queryHash
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY_MS));

    // Generate grounded response
    const { response, sourceIds, unitIds, sources, problemConceptIds } = generateResponse(messageText, quickChip);

    // Add assistant response
    const assistantMessage: ChatMessage = {
      id: createEventId('chat-resp'),
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      retrievedSourceIds: sourceIds,
      textbookUnitIds: unitIds,
      sources,
      quickChip,
      queryHash
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);

    // Log interaction
    logChatInteraction(messageText, response, sourceIds, quickChip, false);

    // Auto-save if quality threshold met
    setTimeout(() => {
      autoSaveToTextbook(assistantMessage, problemConceptIds);
    }, AUTO_SAVE_DELAY_MS);
  }, [inputValue, sessionId, generateResponse, logChatInteraction, autoSaveToTextbook, generateQueryHash]);

  // Handle save to notes
  const handleSaveToNotes = useCallback((messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message || message.role !== 'assistant' || message.savedToNotes) return;

    // Mark as saved
    setMessages(prev => prev.map((m, i) => 
      i === messageIndex ? { ...m, savedToNotes: true } : m
    ));

    // Log the save action
    logChatInteraction(
      'Save to notes',
      message.content,
      message.retrievedSourceIds || [],
      message.quickChip,
      true
    );

    // In a full implementation, this would save to My Notes
    // For now, we just mark it as saved
  }, [messages, logChatInteraction]);

  // Clear chat
  const handleClear = useCallback(() => {
    setMessages([]);
    autoSavedQueriesRef.current.clear();
  }, []);

  const profile = storage.getProfile(learnerId);

  if (!profile) {
    return (
      <Card className="p-4 text-center" data-testid="chat-panel">
        <MessageCircle className="size-8 mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Create a profile to use Ask My Textbook</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col relative" data-testid="chat-panel">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-auto transition-all duration-300',
              toast.type === 'success' 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 text-white'
            )}
          >
            {toast.type === 'success' && <CheckCircle className="size-4" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Ask My Textbook</h3>
        </div>
        {messages.length > 0 && (
          <button 
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Quick Chips */}
      <div className="p-2 border-b bg-gray-50">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map(chip => (
            <button
              type="button"
              key={chip.id}
              onClick={() => handleSend(chip.id)}
              disabled={isLoading || !sessionId}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white border hover:bg-gray-50 disabled:opacity-50"
            >
              <chip.icon className="size-3" />
              <span className="hidden sm:inline">{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto">
        <div className="p-3 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              <BookOpen className="size-8 mx-auto mb-2 opacity-50" />
              <p>Ask a question about this problem</p>
              <p className="text-xs mt-1">or use the quick chips above</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`w-full rounded-lg px-3 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white max-w-[95%]'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words prose prose-sm max-w-none">
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-1.5 last:mb-0 leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
                
                {/* Source indicators for assistant messages */}
                {msg.role === 'assistant' && (
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Source badges */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((source, sIdx) => (
                          <Badge 
                            key={sIdx}
                            variant={source.type === 'unit' ? 'secondary' : 'outline'} 
                            className="text-[10px] h-5 max-w-[150px] truncate"
                            title={source.title}
                          >
                            {source.type === 'unit' ? (
                              <BookOpen className="size-3 mr-1 shrink-0" />
                            ) : (
                              <Hash className="size-3 mr-1 shrink-0" />
                            )}
                            <span className="truncate">{source.title}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Grounding indicator */}
                    <div className="flex items-center gap-2">
                      {msg.retrievedSourceIds && msg.retrievedSourceIds.length > 0 && (
                        <span className="text-[10px] text-gray-500">
                          Grounded in {msg.retrievedSourceIds.length} source{msg.retrievedSourceIds.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      
                      {/* Auto-saved indicator */}
                      {msg.autoSaved && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="size-3 mr-1" />
                          Auto-saved
                        </Badge>
                      )}
                      
                      {/* Save to My Notes button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-[10px] ml-auto"
                        onClick={() => handleSaveToNotes(idx)}
                        disabled={msg.savedToNotes}
                      >
                        <Save className="size-3 mr-1" />
                        {msg.savedToNotes ? 'Saved' : 'Save to My Notes'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about this problem..."
            disabled={isLoading || !sessionId}
            className="flex-1 text-sm"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !inputValue.trim() || !sessionId}
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
