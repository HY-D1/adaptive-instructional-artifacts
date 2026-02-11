// Core data models for the adaptive SQL learning system

export type LearningInterfaceMode = 'student' | 'instructor';

export type ConceptNode = {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  examples: string[];
};

export type ErrorSubtype = {
  id: string;
  pattern: RegExp;
  conceptIds: string[];
  severity: 'low' | 'medium' | 'high';
  description: string;
};

export type HintTemplate = {
  id: string;
  conceptId: string;
  errorSubtypeId: string;
  hintLevel: 1 | 2 | 3; // Progressive hint levels
  content: string;
  nextAction: 'stay' | 'escalate' | 'aggregate';
};

export type InteractionEvent = {
  id: string;
  sessionId?: string;
  learnerId: string;
  timestamp: number;
  eventType: 'code_change' | 'execution' | 'error' | 'hint_request' | 'hint_view' | 'explanation_view';
  problemId: string;
  code?: string;
  error?: string;
  errorSubtypeId?: string;
  hintId?: string;
  hintLevel?: 1 | 2 | 3;
  sqlEngageSubtype?: string;
  sqlEngageRowId?: string;
  policyVersion?: string;
  timeSpent?: number;
  successful?: boolean;
};

export type LearnerProfile = {
  id: string;
  name: string;
  conceptsCovered: Set<string>;
  errorHistory: Map<string, number>; // errorSubtypeId -> count
  interactionCount: number;
  currentStrategy: 'hint-only' | 'adaptive' | 'adaptive-low' | 'adaptive-medium' | 'adaptive-high';
  preferences: {
    escalationThreshold: number; // Number of failed attempts before escalation
    aggregationDelay: number; // Time before aggregating into textbook
  };
};

export type InstructionalUnit = {
  id: string;
  sessionId?: string;
  updatedSessionIds?: string[];
  type: 'hint' | 'explanation' | 'example' | 'summary';
  conceptId: string;
  title: string;
  content: string;
  prerequisites: string[];
  addedTimestamp: number;
  sourceInteractionIds: string[]; // IDs of interactions that triggered this
  sourceInteractions?: string[]; // Legacy compatibility
};

export type SaveTextbookUnitResult = {
  action: 'created' | 'updated';
  unit: InstructionalUnit;
};

export type AdaptiveDecision = {
  timestamp: number;
  learnerId: string;
  context: {
    errorCount: number;
    retryCount: number;
    timeSpent: number;
    currentHintLevel: number;
    recentErrors: string[];
  };
  decision: 'show_hint' | 'show_explanation' | 'add_to_textbook';
  reasoning: string;
  instructionalUnitId?: string;
};

export type SQLProblem = {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  schema: string; // SQL schema for the problem
  expectedQuery: string;
  expectedResult: any[];
  hints?: string[];
};

export type ExperimentCondition = {
  id: string;
  name: string;
  strategy: 'hint-only' | 'adaptive-low' | 'adaptive-medium' | 'adaptive-high';
  description: string;
  parameters: {
    escalationThreshold?: number;
    hintDelay?: number;
    autoAggregation?: boolean;
  };
};
