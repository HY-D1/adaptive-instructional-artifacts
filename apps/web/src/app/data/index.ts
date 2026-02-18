// Central exports for all data modules
export * from './sql-engage';
export * from './problems';
export * from './demo-data';

// Concept Registry (Week 3 D1)
import conceptRegistryJson from './concept-registry.json';
export const conceptRegistry = conceptRegistryJson as import('../types').ConceptRegistry;

// Alignment Map (Week 3 D3)
import alignmentMapJson from './alignment-map.json';
export const alignmentMap = alignmentMapJson as import('../types').AlignmentMap;

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
