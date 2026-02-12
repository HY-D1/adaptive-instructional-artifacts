import {
  InteractionEvent,
  LearnerProfile,
  InstructionalUnit,
  SaveTextbookUnitResult,
  LLMCacheRecord,
  PdfIndexDocument,
  PdfCitation,
  UnitProvenance
} from '../types';
import {
  canonicalizeSqlEngageSubtype,
  getConceptIdsForSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getSqlEngagePolicyVersion
} from '../data/sql-engage';

/**
 * Local storage manager for interaction traces and learner state
 */
class StorageManager {
  private readonly EXPORT_POLICY_VERSION = 'week2-export-sanitize-v1';
  private readonly INTERACTIONS_KEY = 'sql-learning-interactions';
  private readonly PROFILES_KEY = 'sql-learning-profiles';
  private readonly TEXTBOOK_KEY = 'sql-learning-textbook';
  private readonly ACTIVE_SESSION_KEY = 'sql-learning-active-session';
  private readonly LLM_CACHE_KEY = 'sql-learning-llm-cache';
  private readonly REPLAY_MODE_KEY = 'sql-learning-policy-replay-mode';
  private readonly PDF_INDEX_KEY = 'sql-learning-pdf-index';

  startSession(learnerId: string): string {
    const sessionId = `session-${learnerId}-${Date.now()}`;
    localStorage.setItem(this.ACTIVE_SESSION_KEY, sessionId);
    return sessionId;
  }

  getActiveSessionId(): string {
    const existing = localStorage.getItem(this.ACTIVE_SESSION_KEY);
    if (existing) return existing;

    const fallback = 'session-unknown';
    localStorage.setItem(this.ACTIVE_SESSION_KEY, fallback);
    return fallback;
  }

  clearActiveSession() {
    localStorage.removeItem(this.ACTIVE_SESSION_KEY);
  }

  setActiveSessionId(sessionId: string) {
    const normalized = sessionId.trim();
    if (!normalized) {
      this.clearActiveSession();
      return;
    }
    localStorage.setItem(this.ACTIVE_SESSION_KEY, normalized);
  }

  setPolicyReplayMode(enabled: boolean) {
    localStorage.setItem(this.REPLAY_MODE_KEY, JSON.stringify(Boolean(enabled)));
  }

  getPolicyReplayMode(): boolean {
    const raw = localStorage.getItem(this.REPLAY_MODE_KEY);
    if (!raw) return false;
    try {
      return Boolean(JSON.parse(raw));
    } catch {
      return false;
    }
  }

  saveLLMCacheRecord(record: LLMCacheRecord) {
    const cache = this.getLLMCache();
    cache[record.cacheKey] = record;
    localStorage.setItem(this.LLM_CACHE_KEY, JSON.stringify(cache));
  }

  getLLMCacheRecord(cacheKey: string): LLMCacheRecord | null {
    const cache = this.getLLMCache();
    return cache[cacheKey] || null;
  }

  getLLMCache(): Record<string, LLMCacheRecord> {
    const raw = localStorage.getItem(this.LLM_CACHE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  savePdfIndex(document: PdfIndexDocument) {
    localStorage.setItem(this.PDF_INDEX_KEY, JSON.stringify(document));
  }

  getPdfIndex(): PdfIndexDocument | null {
    const raw = localStorage.getItem(this.PDF_INDEX_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Interaction traces
  saveInteraction(event: InteractionEvent) {
    const sessionId = event.sessionId || this.getActiveSessionId();
    const normalizedEvent = { ...event, sessionId };
    const interactions = this.getAllInteractions();
    interactions.push(normalizedEvent);
    localStorage.setItem(this.INTERACTIONS_KEY, JSON.stringify(interactions));
    this.updateProfileStatsFromEvent(normalizedEvent);
  }

  getAllInteractions(): InteractionEvent[] {
    const data = localStorage.getItem(this.INTERACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  getInteractionsByLearner(learnerId: string): InteractionEvent[] {
    return this.getAllInteractions().filter(i => i.learnerId === learnerId);
  }

  getInteractionsByProblem(problemId: string): InteractionEvent[] {
    return this.getAllInteractions().filter(i => i.problemId === problemId);
  }

  getTraceSlice(options?: {
    learnerId?: string;
    problemId?: string;
    sessionId?: string;
    limit?: number;
  }): InteractionEvent[] {
    const learnerId = options?.learnerId;
    const problemId = options?.problemId;
    const sessionId = options?.sessionId;
    const limit = options?.limit;

    const filtered = this.getAllInteractions()
      .filter((interaction) => {
        if (learnerId && interaction.learnerId !== learnerId) return false;
        if (problemId && interaction.problemId !== problemId) return false;
        if (sessionId && interaction.sessionId !== sessionId) return false;
        return true;
      })
      .sort((a, b) => {
        const timestampDelta = a.timestamp - b.timestamp;
        if (timestampDelta !== 0) return timestampDelta;

        const problemDelta = (a.problemId || '').localeCompare(b.problemId || '');
        if (problemDelta !== 0) return problemDelta;

        const typeDelta = (a.eventType || '').localeCompare(b.eventType || '');
        if (typeDelta !== 0) return typeDelta;

        return (a.id || '').localeCompare(b.id || '');
      });

    if (!limit || limit <= 0 || filtered.length <= limit) {
      return filtered;
    }

    return filtered.slice(-limit);
  }

  getInteractionsByIds(interactionIds: string[], learnerId?: string): InteractionEvent[] {
    if (interactionIds.length === 0) return [];

    const source = learnerId
      ? this.getInteractionsByLearner(learnerId)
      : this.getAllInteractions();
    const byId = new Map(source.map((interaction) => [interaction.id, interaction]));
    const dedupedIds = Array.from(new Set(interactionIds));

    return dedupedIds
      .map((id) => byId.get(id))
      .filter((interaction): interaction is InteractionEvent => Boolean(interaction));
  }

  clearInteractions() {
    localStorage.removeItem(this.INTERACTIONS_KEY);
  }

  // Learner profiles
  saveProfile(profile: LearnerProfile) {
    const profiles = this.getAllProfiles();
    const index = profiles.findIndex(p => p.id === profile.id);
    
    // Convert Sets and Maps to arrays for storage
    const serializable = {
      ...profile,
      currentStrategy: this.normalizeStrategy(profile.currentStrategy),
      conceptsCovered: Array.from(profile.conceptsCovered),
      errorHistory: Array.from(profile.errorHistory.entries())
    };
    
    if (index >= 0) {
      profiles[index] = serializable;
    } else {
      profiles.push(serializable);
    }
    
    localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));
  }

  getProfile(learnerId: string): LearnerProfile | null {
    const profiles = this.getAllProfiles();
    const profile = profiles.find(p => p.id === learnerId);
    
    if (!profile) return null;
    
    // Convert arrays back to Sets and Maps
    return {
      ...profile,
      conceptsCovered: new Set((profile.conceptsCovered || []) as any),
      errorHistory: new Map((profile.errorHistory || []) as any),
      currentStrategy: this.normalizeStrategy(profile.currentStrategy)
    };
  }

  getAllProfiles(): any[] {
    const data = localStorage.getItem(this.PROFILES_KEY);
    return data ? JSON.parse(data) : [];
  }

  createDefaultProfile(learnerId: string, strategy: LearnerProfile['currentStrategy'] = 'adaptive-medium'): LearnerProfile {
    const profile: LearnerProfile = {
      id: learnerId,
      name: `Learner ${learnerId}`,
      conceptsCovered: new Set(),
      errorHistory: new Map(),
      interactionCount: 0,
      currentStrategy: this.normalizeStrategy(strategy),
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000 // 5 minutes
      }
    };
    this.saveProfile(profile);
    return profile;
  }

  // Textbook/instructional units
  saveTextbookUnit(learnerId: string, unit: InstructionalUnit): SaveTextbookUnitResult {
    const textbooks = this.getAllTextbooks();
    if (!textbooks[learnerId]) {
      textbooks[learnerId] = [];
    }
    const activeSessionId = unit.sessionId || this.getActiveSessionId();
    const normalizedSourceIds = this.mergeIds(unit.sourceInteractionIds, unit.sourceInteractions);
    const dedupKeyByHash = unit.provenance?.inputHash;
    const dedupKeyFallback = this.buildUnitFallbackDedupKey(unit);
    const existing = textbooks[learnerId].find((candidate) => {
      const candidateHash = candidate.provenance?.inputHash;
      if (dedupKeyByHash && candidateHash && candidateHash === dedupKeyByHash) {
        return true;
      }
      const candidateFallback = this.buildUnitFallbackDedupKey(candidate);
      return candidateFallback === dedupKeyFallback;
    });

    if (existing) {
      const existingSourceIds = this.mergeIds(existing.sourceInteractionIds, existing.sourceInteractions);
      existing.sourceInteractionIds = this.mergeIds(existingSourceIds, normalizedSourceIds);
      existing.addedTimestamp = Date.now();
      existing.content = unit.content;
      existing.title = unit.title;
      existing.sessionId = existing.sessionId || activeSessionId;
      existing.provenance = this.mergeProvenance(existing.provenance, unit.provenance);
      existing.lastErrorSubtypeId = unit.lastErrorSubtypeId || existing.lastErrorSubtypeId;
      existing.updatedSessionIds = Array.from(new Set([
        ...(existing.updatedSessionIds || []),
        activeSessionId
      ]));

      localStorage.setItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
      return {
        action: 'updated',
        unit: {
          ...existing,
          sourceInteractionIds: this.mergeIds(existing.sourceInteractionIds, existing.sourceInteractions)
        }
      };
    } else {
      const created = {
        ...unit,
        sessionId: activeSessionId,
        updatedSessionIds: [activeSessionId],
        sourceInteractionIds: normalizedSourceIds
      };
      textbooks[learnerId].push(created);

      localStorage.setItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
      return {
        action: 'created',
        unit: created
      };
    }
  }

  getTextbook(learnerId: string): InstructionalUnit[] {
    const textbooks = this.getAllTextbooks();
    const units = textbooks[learnerId] || [];
    return units.map(unit => ({
      ...unit,
      sourceInteractionIds: this.mergeIds(unit.sourceInteractionIds, unit.sourceInteractions)
    }));
  }

  private mergeIds(...sources: Array<string[] | undefined>): string[] {
    return Array.from(
      new Set(
        sources
          .flatMap((source) => source || [])
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
  }

  private buildUnitFallbackDedupKey(unit: InstructionalUnit): string {
    const conceptId = (unit.conceptId || 'unknown-concept').trim().toLowerCase();
    const errorSubtype = (unit.lastErrorSubtypeId || 'unknown').trim().toLowerCase();
    const templateId = (unit.provenance?.templateId || 'template-unknown').trim().toLowerCase();
    const unitType = (unit.type || 'summary').trim().toLowerCase();
    return `${conceptId}::${errorSubtype}::${templateId}::${unitType}`;
  }

  private mergeProvenance(
    existing?: UnitProvenance,
    incoming?: UnitProvenance
  ): UnitProvenance | undefined {
    if (!existing && !incoming) {
      return undefined;
    }

    const mergedRetrievedSourceIds = this.mergeIds(
      existing?.retrievedSourceIds,
      incoming?.retrievedSourceIds
    );
    const createdAtCandidates = [existing?.createdAt, incoming?.createdAt].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value)
    );
    const createdAt = createdAtCandidates.length > 0
      ? Math.min(...createdAtCandidates)
      : Date.now();
    const retrievedPdfCitations = this.mergePdfCitations(
      existing?.retrievedPdfCitations,
      incoming?.retrievedPdfCitations
    );

    return {
      ...(existing || incoming!),
      ...(incoming || {}),
      createdAt,
      retrievedSourceIds: mergedRetrievedSourceIds,
      ...(retrievedPdfCitations.length > 0 ? { retrievedPdfCitations } : {})
    };
  }

  private mergePdfCitations(...sources: Array<PdfCitation[] | undefined>): PdfCitation[] {
    const bestByChunkId = new Map<string, PdfCitation>();
    for (const source of sources) {
      for (const citation of source || []) {
        if (!citation || !citation.chunkId) continue;
        const page = Number(citation.page);
        if (!Number.isFinite(page)) continue;
        const score = Number.isFinite(Number(citation.score)) ? Number(citation.score) : 0;
        const normalized: PdfCitation = {
          chunkId: citation.chunkId,
          page,
          score
        };
        const existing = bestByChunkId.get(normalized.chunkId);
        if (!existing || normalized.score > existing.score) {
          bestByChunkId.set(normalized.chunkId, normalized);
        }
      }
    }
    return Array.from(bestByChunkId.values());
  }

  getAllTextbooks(): Record<string, InstructionalUnit[]> {
    const data = localStorage.getItem(this.TEXTBOOK_KEY);
    return data ? JSON.parse(data) : {};
  }

  clearTextbook(learnerId: string) {
    const textbooks = this.getAllTextbooks();
    delete textbooks[learnerId];
    localStorage.setItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
  }

  // Export data for research
  exportData(options?: { allHistory?: boolean }) {
    const allHistory = options?.allHistory === true;
    const activeSessionId = this.getActiveSessionId();
    const interactions = this.getAllInteractions().filter(i => {
      if (allHistory) return true;
      return i.sessionId === activeSessionId;
    }).map((interaction) => this.normalizeInteractionForExport(interaction, activeSessionId));
    const allTextbooks = this.getAllTextbooks();
    const textbooks = Object.fromEntries(
      Object.entries(allTextbooks).map(([learnerId, units]) => [
        learnerId,
        units.filter(unit => {
          if (allHistory) return true;
          return unit.sessionId === activeSessionId || (unit.updatedSessionIds || []).includes(activeSessionId);
        })
      ])
    );

    const serializableProfiles = this.getAllProfiles().map(profile => {
      const learnerInteractions = interactions.filter(i => i.learnerId === profile.id);
      const errors = learnerInteractions.filter(i => i.eventType === 'error').length;
      const conceptsCoveredSet = new Set<string>(profile.conceptsCovered || []);
      learnerInteractions.forEach(i => {
        getConceptIdsForSqlEngageSubtype(i.sqlEngageSubtype || i.errorSubtypeId).forEach(c => conceptsCoveredSet.add(c));
      });

      return {
        ...profile,
        interactionCount: learnerInteractions.length,
        errors,
        conceptsCovered: Array.from(conceptsCoveredSet)
      };
    });

    return {
      interactions,
      profiles: serializableProfiles,
      textbooks,
      llmCache: this.getLLMCache(),
      replayMode: this.getPolicyReplayMode(),
      pdfIndex: this.getPdfIndex(),
      activeSessionId,
      exportScope: allHistory ? 'all-history' : 'active-session',
      exportPolicyVersion: this.EXPORT_POLICY_VERSION,
      exportedAt: new Date().toISOString()
    };
  }

  exportAllData() {
    return this.exportData({ allHistory: true });
  }

  importData(data: any) {
    if (data.interactions) {
      localStorage.setItem(this.INTERACTIONS_KEY, JSON.stringify(data.interactions));
    }
    if (data.profiles) {
      localStorage.setItem(this.PROFILES_KEY, JSON.stringify(data.profiles));
    }
    if (data.textbooks) {
      localStorage.setItem(this.TEXTBOOK_KEY, JSON.stringify(data.textbooks));
    }
    if (data.llmCache) {
      localStorage.setItem(this.LLM_CACHE_KEY, JSON.stringify(data.llmCache));
    }
    if (typeof data.replayMode === 'boolean') {
      this.setPolicyReplayMode(data.replayMode);
    }
    if (data.pdfIndex) {
      this.savePdfIndex(data.pdfIndex);
    }

    const importedActiveSessionId = typeof data.activeSessionId === 'string'
      ? data.activeSessionId.trim()
      : '';
    if (importedActiveSessionId) {
      this.setActiveSessionId(importedActiveSessionId);
      return;
    }

    const interactions = Array.isArray(data.interactions) ? data.interactions : [];
    const fallbackActiveSessionId = [...interactions]
      .sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0))
      .map((interaction) => (typeof interaction?.sessionId === 'string' ? interaction.sessionId.trim() : ''))
      .find((session): session is string => Boolean(session));
    if (fallbackActiveSessionId) {
      this.setActiveSessionId(fallbackActiveSessionId);
      return;
    }

    this.clearActiveSession();
  }

  clearAll() {
    this.clearInteractions();
    this.clearActiveSession();
    localStorage.removeItem(this.PROFILES_KEY);
    localStorage.removeItem(this.TEXTBOOK_KEY);
    localStorage.removeItem(this.LLM_CACHE_KEY);
    localStorage.removeItem(this.REPLAY_MODE_KEY);
    localStorage.removeItem(this.PDF_INDEX_KEY);
  }

  private updateProfileStatsFromEvent(event: InteractionEvent) {
    const profile = this.getProfile(event.learnerId);
    if (!profile) return;

    profile.interactionCount += 1;

    const subtype = event.sqlEngageSubtype || event.errorSubtypeId;
    if (subtype) {
      profile.errorHistory.set(subtype, (profile.errorHistory.get(subtype) || 0) + 1);
      getConceptIdsForSqlEngageSubtype(subtype).forEach(conceptId => profile.conceptsCovered.add(conceptId));
    }

    this.saveProfile(profile);
  }

  private normalizeStrategy(strategy: unknown): LearnerProfile['currentStrategy'] {
    if (
      strategy === 'hint-only' ||
      strategy === 'adaptive-low' ||
      strategy === 'adaptive-medium' ||
      strategy === 'adaptive-high'
    ) {
      return strategy;
    }
    return 'adaptive-medium';
  }

  private normalizeInteractionForExport(
    interaction: InteractionEvent,
    activeSessionId: string
  ): InteractionEvent {
    const normalizedSessionId = interaction.sessionId || activeSessionId || 'session-unknown';
    const withSession = {
      ...interaction,
      sessionId: normalizedSessionId
    };

    if (withSession.eventType !== 'hint_view') {
      return withSession;
    }

    return this.normalizeHintViewForExport(withSession);
  }

  private normalizeHintViewForExport(interaction: InteractionEvent): InteractionEvent {
    const canonicalSubtype = canonicalizeSqlEngageSubtype(
      interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'incomplete query'
    );
    const hintLevel = this.clampHintLevel(interaction.hintLevel);
    const rowSeed = `${interaction.learnerId}|${interaction.problemId}|${canonicalSubtype}`;
    const fallbackAnchor = getDeterministicSqlEngageAnchor(canonicalSubtype, rowSeed);
    const sqlEngageRowId = interaction.sqlEngageRowId?.trim() || fallbackAnchor.rowId;
    const policyVersion = interaction.policyVersion?.trim() || getSqlEngagePolicyVersion();
    const { hintId: _legacyHintId, ...withoutLegacyHintId } = interaction;

    return {
      ...withoutLegacyHintId,
      eventType: 'hint_view',
      hintLevel,
      sqlEngageSubtype: canonicalSubtype,
      sqlEngageRowId,
      policyVersion
    };
  }

  private clampHintLevel(value: unknown): 1 | 2 | 3 {
    if (value === 1 || value === 2 || value === 3) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value <= 1) return 1;
      if (value >= 3) return 3;
      return 2;
    }
    return 1;
  }
}

export const storage = new StorageManager();
