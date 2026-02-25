/**
 * useEnhancedHints Hook
 * 
 * React hook for the enhanced hint service that intelligently uses
 * available resources (Textbook + LLM) or falls back to SQL-Engage CSV.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { InteractionEvent, InstructionalUnit } from '../types';
import type { GuidanceRung } from '../lib/guidance-ladder';
import {
  generateEnhancedHint,
  checkAvailableResources,
  getHintStrategyDescription,
  preloadHintContext,
  type EnhancedHint,
  type AvailableResources
} from '../lib/enhanced-hint-service';

export type UseEnhancedHintsOptions = {
  learnerId: string;
  problemId: string;
  sessionId?: string;
  recentInteractions: InteractionEvent[];
};

export type UseEnhancedHintsReturn = {
  /** Generate a hint for the current context */
  generateHint: (rung: GuidanceRung, errorSubtypeId?: string) => Promise<EnhancedHint>;
  /** Check which resources are available */
  checkResources: () => AvailableResources;
  /** Get description of current strategy */
  getStrategyDescription: () => string;
  /** Preload hint context for an error subtype */
  preloadContext: (errorSubtypeId: string) => Promise<void>;
  /** Whether a hint is being generated */
  isGenerating: boolean;
  /** Last generated hint */
  lastHint: EnhancedHint | null;
  /** Available resources (cached) */
  availableResources: AvailableResources;
  /** Error if hint generation failed */
  error: Error | null;
  /** Clear error state */
  clearError: () => void;
};

/**
 * Hook for enhanced hint generation
 */
export function useEnhancedHints(options: UseEnhancedHintsOptions): UseEnhancedHintsReturn {
  const { learnerId, problemId, sessionId, recentInteractions } = options;
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastHint, setLastHint] = useState<EnhancedHint | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [availableResources, setAvailableResources] = useState<AvailableResources>({
    sqlEngage: true,
    textbook: false,
    llm: false,
    pdfIndex: false
  });
  
  // Cache resources to avoid repeated checks
  const resourcesRef = useRef<AvailableResources | null>(null);
  
  // Check resources on mount
  useEffect(() => {
    const resources = checkAvailableResources(learnerId);
    resourcesRef.current = resources;
    setAvailableResources(resources);
  }, [learnerId]);
  
  /**
   * Generate a hint for the given rung and error context
   */
  const generateHint = useCallback(async (
    rung: GuidanceRung,
    errorSubtypeId?: string
  ): Promise<EnhancedHint> => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const hint = await generateEnhancedHint({
        learnerId,
        problemId,
        sessionId,
        errorSubtypeId,
        rung,
        recentInteractions
      });
      
      setLastHint(hint);
      return hint;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate hint');
      setError(error);
      throw error;
      
    } finally {
      setIsGenerating(false);
    }
  }, [learnerId, problemId, sessionId, recentInteractions]);
  
  /**
   * Check which resources are available
   */
  const checkResources = useCallback((): AvailableResources => {
    const resources = checkAvailableResources(learnerId);
    resourcesRef.current = resources;
    setAvailableResources(resources);
    return resources;
  }, [learnerId]);
  
  /**
   * Get description of current hint strategy
   */
  const getStrategyDescription = useCallback((): string => {
    const resources = resourcesRef.current || checkAvailableResources(learnerId);
    return getHintStrategyDescription(resources);
  }, [learnerId]);
  
  /**
   * Preload hint context for an error subtype
   */
  const preloadContext = useCallback(async (errorSubtypeId: string): Promise<void> => {
    await preloadHintContext(learnerId, errorSubtypeId);
  }, [learnerId]);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    generateHint,
    checkResources,
    getStrategyDescription,
    preloadContext,
    isGenerating,
    lastHint,
    availableResources,
    error,
    clearError
  };
}

export default useEnhancedHints;
