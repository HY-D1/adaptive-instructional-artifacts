// Central exports for all data modules
export * from './sql-engage';
export * from './problems';
export * from './demo-data';

import type { ConceptRegistry, AlignmentMap, ConceptRegistryEntry, AlignmentMapEntry } from '../types';

// Concept Registry (Week 3 D1)
import conceptRegistryJson from './concept-registry.json';

// Runtime validation for concept registry
function validateConceptRegistry(data: unknown): ConceptRegistry {
  if (!data || typeof data !== 'object') {
    console.warn('[Data] Invalid concept registry: expected object');
    return { concepts: [], version: 'unknown', lastUpdated: Date.now() };
  }
  
  const raw = data as Record<string, unknown>;
  
  // Validate concepts array
  if (!Array.isArray(raw.concepts)) {
    console.warn('[Data] Invalid concept registry: concepts must be an array');
    return { concepts: [], version: String(raw.version ?? 'unknown'), lastUpdated: Date.now() };
  }
  
  // Validate each concept entry
  const validConcepts: ConceptRegistryEntry[] = raw.concepts.filter((c: unknown) => {
    if (!c || typeof c !== 'object') return false;
    const concept = c as Record<string, unknown>;
    return (
      typeof concept.conceptId === 'string' &&
      typeof concept.title === 'string' &&
      Array.isArray(concept.tags)
    );
  }) as ConceptRegistryEntry[];
  
  if (validConcepts.length !== raw.concepts.length) {
    console.warn(`[Data] Filtered ${raw.concepts.length - validConcepts.length} invalid concept entries`);
  }
  
  return {
    concepts: validConcepts,
    version: String(raw.version ?? 'unknown'),
    lastUpdated: typeof raw.lastUpdated === 'number' ? raw.lastUpdated : Date.now()
  };
}

export const conceptRegistry: ConceptRegistry = validateConceptRegistry(conceptRegistryJson);

// Alignment Map (Week 3 D3)
import alignmentMapJson from './alignment-map.json';

// Runtime validation for alignment map
function validateAlignmentMap(data: unknown): AlignmentMap {
  if (!data || typeof data !== 'object') {
    console.warn('[Data] Invalid alignment map: expected object');
    return { mappings: [], version: 'unknown', lastUpdated: Date.now() };
  }
  
  const raw = data as Record<string, unknown>;
  
  // Validate mappings array
  if (!Array.isArray(raw.mappings)) {
    console.warn('[Data] Invalid alignment map: mappings must be an array');
    return { mappings: [], version: String(raw.version ?? 'unknown'), lastUpdated: Date.now() };
  }
  
  // Validate each mapping entry
  const validMappings: AlignmentMapEntry[] = raw.mappings.filter((m: unknown) => {
    if (!m || typeof m !== 'object') return false;
    const mapping = m as Record<string, unknown>;
    return (
      typeof mapping.sqlEngageSubtype === 'string' &&
      Array.isArray(mapping.textbookConceptIds) &&
      typeof mapping.status === 'string'
    );
  }) as AlignmentMapEntry[];
  
  if (validMappings.length !== raw.mappings.length) {
    console.warn(`[Data] Filtered ${raw.mappings.length - validMappings.length} invalid mapping entries`);
  }
  
  return {
    mappings: validMappings,
    version: String(raw.version ?? 'unknown'),
    lastUpdated: typeof raw.lastUpdated === 'number' ? raw.lastUpdated : Date.now()
  };
}

export const alignmentMap: AlignmentMap = validateAlignmentMap(alignmentMapJson);

// Helper functions for concept registry
export function getConceptFromRegistry(conceptId: string): import('../types').ConceptRegistryEntry | undefined {
  return conceptRegistry.concepts.find(c => c.conceptId === conceptId);
}

export function getVerifiedConcepts(): import('../types').ConceptRegistryEntry[] {
  return conceptRegistry.concepts.filter(c => c.status === 'verified');
}

export function getConceptsByTag(tag: string): import('../types').ConceptRegistryEntry[] {
  return conceptRegistry.concepts.filter(c => c.tags.includes(tag));
}

export function getSourceRefsForConcept(conceptId: string): import('../types').ConceptRegistrySourceRef[] {
  const concept = getConceptFromRegistry(conceptId);
  return concept?.sourceRefs ?? [];
}

// Helper functions for alignment map (Week 3 D3)
export function getAlignmentForSubtype(sqlEngageSubtype: string): import('../types').AlignmentMapEntry | undefined {
  return alignmentMap.mappings.find(m => m.sqlEngageSubtype === sqlEngageSubtype);
}

export function getTextbookConceptIdsForSubtype(sqlEngageSubtype: string): string[] {
  return getAlignmentForSubtype(sqlEngageSubtype)?.textbookConceptIds ?? [];
}

export function isSubtypeVerified(sqlEngageSubtype: string): boolean {
  return getAlignmentForSubtype(sqlEngageSubtype)?.status === 'verified';
}

export function canAutoEscalate(sqlEngageSubtype: string): boolean {
  const mapping = getAlignmentForSubtype(sqlEngageSubtype);
  if (!mapping) return false;
  return mapping.status === 'verified' && !mapping.excludedFromAutoEscalation;
}

export function getVerifiedMappings(): import('../types').AlignmentMapEntry[] {
  return alignmentMap.mappings.filter(m => m.status === 'verified');
}

export function getAutoEscalationEligibleMappings(): import('../types').AlignmentMapEntry[] {
  return alignmentMap.mappings.filter(m => m.status === 'verified' && !m.excludedFromAutoEscalation);
}
