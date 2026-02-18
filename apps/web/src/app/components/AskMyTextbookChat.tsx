/**
 * Ask My Textbook Chat Component (Week 3 Feature)
 * 
 * A chat panel in the sidebar for grounded Q&A with textbook content.
 * - Each user message gets a grounded response
 * - "Save to My Notes" button for each response
 * - Quick chips for common queries
 * - Logs chat_interaction events with retrievedSourceIds
 */

import { useState, useRef, useCallback } from 'react';
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
  X
} from 'lucide-react';
// Note: Using div with overflow-auto instead of ScrollArea
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
  quickChip?: string;
  sources?: Array<{id: string; title: string; type: 'unit' | 'pdf'}>;
};

interface AskMyTextbookChatProps {
  sessionId?: string;
  learnerId: string;
  problemId: string;
  recentInteractions: InteractionEvent[];
  onInteractionLogged?: (event: InteractionEvent) => void;
}

// Quick chip options
const QUICK_CHIPS = [
  { id: 'explain_error', label: 'Explain my last error', icon: AlertCircle },
  { id: 'minimal_example', label: 'Show a minimal example', icon: Code },
  { id: 'what_concept', label: 'What concept is this?', icon: HelpCircle },
  { id: 'hint_response', label: 'Give me a hint', icon: Lightbulb },
] as const;

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get textbook units for grounding
  const getTextbookUnits = useCallback((): InstructionalUnit[] => {
    return storage.getTextbook(learnerId);
  }, [learnerId]);

  // Build retrieval bundle for grounding - prioritizes current problem context
  const buildGroundingPayload = useCallback((query: string, quickChip?: string) => {
    const problem = getProblemById(problemId);
    const textbookUnits = getTextbookUnits();
    
    // Get current problem's concepts
    const problemConceptIds = problem?.concepts || [];
    
    // Get the last error subtype for context
    const lastError = [...recentInteractions]
      .reverse()
      .find(i => i.eventType === 'error');
    const errorSubtype = lastError?.sqlEngageSubtype || lastError?.errorSubtypeId;
    
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
    
    // Take top 3 most relevant
    relevantUnits = relevantUnits.slice(0, 3);

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
          pdfTopK: 3
        });
        bundleSources = bundle.retrievedSourceIds;
        pdfPassages = bundle.pdfPassages.map(p => ({
          docId: p.docId,
          page: p.page,
          text: cleanText(p.text)
        })).filter(p => p.text.length > 50); // Filter out short/irrelevant passages
      } catch {
        // Bundle building failed
      }
    }

    return {
      relevantUnits,
      bundleSources,
      pdfPassages,
      allSourceIds: [
        ...relevantUnits.map(u => u.id),
        ...bundleSources
      ],
      problemConceptIds,
      errorSubtype
    };
  }, [learnerId, problemId, recentInteractions, getTextbookUnits]);

  // Clean up text for better readability
  const cleanText = useCallback((text: string): string => {
    return text
      .replace(/_/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/Figure \d+-\d+[^.]*/g, '')
      .trim();
  }, []);

  // Generate grounded response using retrieved sources
  const generateResponse = useCallback((query: string, quickChip?: string): { 
    response: string; 
    sourceIds: string[];
    unitIds: string[];
    sources: Array<{id: string; title: string; type: 'unit' | 'pdf'}>;
  } => {
    const { 
      relevantUnits, 
      bundleSources, 
      pdfPassages,
      allSourceIds,
      problemConceptIds,
      errorSubtype
    } = buildGroundingPayload(query, quickChip);
    
    // Build source list for display
    const sources = [
      ...relevantUnits.map(u => ({ id: u.id, title: u.title, type: 'unit' as const })),
      ...bundleSources.map(id => ({ id, title: id.split('-p')[0] || id, type: 'pdf' as const }))
    ];
    
    // Generate response based on quick chip or query
    let response = '';
    
    if (quickChip === 'explain_error') {
      const lastError = [...recentInteractions]
        .reverse()
        .find(i => i.eventType === 'error');
      if (lastError) {
        const errorType = lastError.errorSubtypeId || lastError.sqlEngageSubtype || 'unknown';
        response = `**Error Type:** ${errorType}\n\n`;
        
        // Prioritize PDF passages for error explanation (most relevant)
        if (pdfPassages.length > 0) {
          response += `**From your textbook:**\n\n${pdfPassages[0].text.substring(0, 400)}...\n\n`;
        }
        
        if (relevantUnits.length > 0) {
          const unit = relevantUnits[0];
          const content = cleanText(unit.summary || unit.content || '');
          if (!response.includes(content.substring(0, 100))) {
            response += `**Explanation:**\n${content}`;
          }
        } else if (pdfPassages.length === 0) {
          response += `Based on your error, check your query structure. Make sure table names and column names are spelled correctly.`;
        }
      } else {
        response = 'I don\'t see any recent errors. Try running a query first!';
      }
    } else if (quickChip === 'minimal_example') {
      // Try to find example from PDF passages first, then units
      const passageWithCode = pdfPassages.find(p => 
        p.text.toLowerCase().includes('select') || 
        p.text.toLowerCase().includes('from')
      );
      
      if (passageWithCode) {
        response = `**Example from textbook:**\n\n\`\`\`sql\n${passageWithCode.text.substring(0, 300)}\n\`\`\``;
      } else {
        const unitWithExample = relevantUnits.find(u => u.minimalExample);
        if (unitWithExample?.minimalExample) {
          response = `**Example:**\n\n\`\`\`sql\n${cleanText(unitWithExample.minimalExample)}\n\`\`\``;
        } else {
          response = '**Example:**\n\n```sql\nSELECT * FROM table_name;\n```';
        }
      }
    } else if (quickChip === 'what_concept') {
      const problem = getProblemById(problemId);
      if (problem?.concepts.length || problemConceptIds.length) {
        const concepts = problem?.concepts || problemConceptIds;
        response = `**This problem involves:** ${concepts.join(', ')}\n\n`;
        
        if (relevantUnits.length) {
          response += `**From your textbook:**\n${relevantUnits.map(u => `• ${u.title}`).join('\n')}`;
        } else if (pdfPassages.length > 0) {
          response += `**Related material:**\n${pdfPassages[0].text.substring(0, 250)}...`;
        } else {
          response += 'Work through this by identifying which tables and columns you need.';
        }
      } else {
        response = 'This problem involves SQL query construction. Check your syntax and table references.';
      }
    } else if (quickChip === 'hint_response') {
      // Check PDF passages first for hints
      const hintPassage = pdfPassages.find(p => 
        p.text.toLowerCase().includes('hint') ||
        p.text.toLowerCase().includes('remember') ||
        p.text.toLowerCase().includes('note')
      );
      
      if (hintPassage) {
        response = `**Hint from textbook:**\n\n${hintPassage.text.substring(0, 300)}`;
      } else if (relevantUnits.length && relevantUnits[0]?.summary) {
        response = `**Hint:**\n\n${cleanText(relevantUnits[0].summary)}`;
      } else if (relevantUnits.length) {
        response = `**Hint:** Check the explanation in "${relevantUnits[0].title}" from your textbook.`;
      } else {
        response = '**Hint:** Start by identifying the tables you need, then build your SELECT clause.';
      }
    } else {
      // Custom query response - synthesize from multiple sources
      const unitContent = relevantUnits[0];
      const pdfContent = pdfPassages[0];
      
      if (relevantUnits.length && unitContent) {
        const content = cleanText(unitContent.summary || unitContent.content || '');
        response = `**${unitContent.title}**\n\n${content}`;
        
        // Add PDF excerpt if different from unit content
        if (pdfContent && !content.includes(pdfContent.text.substring(0, 100))) {
          response += `\n\n**Also from textbook (page ${pdfContent.page}):**\n${pdfContent.text.substring(0, 250)}...`;
        }
      } else if (pdfContent) {
        response = `**From your textbook (page ${pdfContent.page}):**\n\n${pdfContent.text.substring(0, 500)}`;
      } else {
        response = `I don't have specific notes about that in your textbook yet. Try using the Guidance Ladder for hints, or ask a more specific question.`;
      }
    }

    return {
      response,
      sourceIds: allSourceIds,
      unitIds: relevantUnits.map(u => u.id),
      sources
    };
  }, [buildGroundingPayload, recentInteractions, problemId, cleanText]);

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

    // Add user message
    const userMessage: ChatMessage = {
      id: createEventId('chat-msg'),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      quickChip
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate grounded response
    const { response, sourceIds, unitIds, sources } = generateResponse(messageText, quickChip);

    // Add assistant response
    const assistantMessage: ChatMessage = {
      id: createEventId('chat-resp'),
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      retrievedSourceIds: sourceIds,
      textbookUnitIds: unitIds,
      sources,
      quickChip
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);

    // Log interaction
    logChatInteraction(messageText, response, sourceIds, quickChip, false);
  }, [inputValue, sessionId, generateResponse, logChatInteraction]);

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
    <Card className="flex flex-col" data-testid="chat-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Ask My Textbook</h3>
        </div>
        {messages.length > 0 && (
          <button 
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
