import { InteractionEvent, LearnerProfile, InstructionalUnit, SaveTextbookUnitResult } from '../types';
import { getConceptIdsForSqlEngageSubtype } from '../data/sql-engage';

/**
 * Local storage manager for interaction traces and learner state
 */
class StorageManager {
  private readonly INTERACTIONS_KEY = 'sql-learning-interactions';
  private readonly PROFILES_KEY = 'sql-learning-profiles';
  private readonly TEXTBOOK_KEY = 'sql-learning-textbook';
  private readonly ACTIVE_SESSION_KEY = 'sql-learning-active-session';

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
      .sort((a, b) => a.timestamp - b.timestamp);

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
      errorHistory: new Map((profile.errorHistory || []) as any)
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
      currentStrategy: strategy,
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
    const normalizedSourceIds = Array.from(new Set([
      ...(unit.sourceInteractionIds || []),
      ...(unit.sourceInteractions || [])
    ]));
    const dedupKey = `${unit.type}::${unit.conceptId}::${unit.title}`;
    const existing = textbooks[learnerId].find(u => `${u.type}::${u.conceptId}::${u.title}` === dedupKey);

    if (existing) {
      const existingSourceIds = Array.from(new Set([
        ...(existing.sourceInteractionIds || []),
        ...(existing.sourceInteractions || [])
      ]));
      existing.sourceInteractionIds = Array.from(new Set([...existingSourceIds, ...normalizedSourceIds]));
      existing.addedTimestamp = Date.now();
      existing.content = unit.content;
      existing.sessionId = existing.sessionId || activeSessionId;
      existing.updatedSessionIds = Array.from(new Set([
        ...(existing.updatedSessionIds || []),
        activeSessionId
      ]));

      localStorage.setItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
      return {
        action: 'updated',
        unit: {
          ...existing,
          sourceInteractionIds: Array.from(new Set([
            ...(existing.sourceInteractionIds || []),
            ...(existing.sourceInteractions || [])
          ]))
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
      sourceInteractionIds: Array.from(new Set([
        ...(unit.sourceInteractionIds || []),
        ...(unit.sourceInteractions || [])
      ]))
    }));
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
    const allHistory = options?.allHistory ?? false;
    const activeSessionId = this.getActiveSessionId();
    const interactions = this.getAllInteractions().filter(i => {
      if (allHistory) return true;
      return i.sessionId === activeSessionId;
    }).map(i => ({
      ...i,
      sessionId: i.sessionId || activeSessionId || 'session-unknown'
    }));
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
      activeSessionId,
      exportScope: allHistory ? 'all-history' : 'active-session',
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
  }

  clearAll() {
    this.clearInteractions();
    localStorage.removeItem(this.PROFILES_KEY);
    localStorage.removeItem(this.TEXTBOOK_KEY);
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
}

export const storage = new StorageManager();
