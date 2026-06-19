/**
 * Mission Context Engine — Type Definitions
 *
 * All interfaces for the goal-centric memory system.
 * Context is derived from memory, not message history.
 */

// ---------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------

export interface Mission {
  id: string;
  missionId: string;
  userId: string;
  title: string;
  summary: string;
  currentSummary: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  goalIds?: string[];
  description?: string;
}

export interface MissionEvent {
  eventId: string;
  missionId: string;
  userId: string;
  type: "command" | "ai_output" | "opportunity" | "contact" | "follow_up" | "gmail_thread";
  content: string;
  metadata: Record<string, any>;
  sequenceNumber: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Command History
// ---------------------------------------------------------------------------

export interface CommandRecord {
  id?: string;
  userId: string;
  command: string;
  missionId: string | null;
  intent: string;
  outcomeType: "redirect" | "display" | "action" | "error";
  targetContactId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Context Assembly
// ---------------------------------------------------------------------------

/** A single fragment of context retrieved from a Firestore source. */
export interface ContextSource {
  type:
    | "user_profile"
    | "mission"
    | "goal"
    | "contact"
    | "company"
    | "command_history"
    | "gmail"
    | "research"
    | "opportunity"
    | "follow_up"
    | "preference";
  /** Human-readable label shown in the context package. */
  label: string;
  /** The actual text payload injected into the prompt. */
  content: string;
  /** Relevance score 0-100 computed by the ranking algorithm. */
  relevanceScore: number;
  /** Estimated token count for this fragment. */
  tokenEstimate: number;
}

/** Configurable weights used by the relevance ranking algorithm. */
export interface RelevanceWeights {
  /** Weight for keyword overlap between command and content (0-30). */
  keywordOverlap: number;
  /** Weight for recency — exponential decay (0-30). */
  recency: number;
  /** Weight for relationship strength (0-20). */
  relationshipStrength: number;
  /** Weight for mission/goal alignment (0-20). */
  missionAlignment: number;
}

/** Contact data enriched with research for context assembly. */
export interface EnrichedContact {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  notes: string;
  relationshipStatus: string;
  goalId: string | null;
}

/** Company data derived from contacts and research. */
export interface CompanyContext {
  name: string;
  info: string;
  contactCount: number;
  contactNames: string[];
}

/** Gmail thread metadata for context (no message bodies). */
export interface GmailThreadContext {
  subject: string;
  contactName: string;
  status: string;
  updatedAt: string;
}

/** The final structured context package sent to agents. */
export interface MissionContextPackage {
  /** Active mission (null if none set). */
  mission: { title: string; description: string; summary?: string; currentSummary?: string } | null;
  recentEvents?: string[];
  /** User profile summary. */
  userProfile: string;
  /** Active goals. */
  goals: string[];
  /** Relevant contacts with key details. */
  relevantContacts: string[];
  /** Deduplicated company profiles. */
  relevantCompanies: string[];
  /** Recent user commands for behavioral continuity. */
  recentCommands: string[];
  /** Gmail thread metadata for mission contacts. */
  gmailContext: string[];
  /** Pending opportunities sorted by score. */
  opportunities: string[];
  /** Follow-up history and pending actions. */
  followUpHistory: string[];
  /** Research insights for relevant contacts. */
  researchInsights: string[];
  /** User communication preferences. */
  userPreferences: string;
  /** Total estimated tokens in this package. */
  totalTokens: number;
  /** True if context was truncated to fit budget. */
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default token budget for context package. */
export const DEFAULT_TOKEN_BUDGET = 6000;

/** Maximum number of recent commands to include. */
export const MAX_RECENT_COMMANDS = 10;

/** Maximum number of contacts to include in context. */
export const MAX_CONTEXT_CONTACTS = 10;

/** Maximum number of Gmail threads to include. */
export const MAX_GMAIL_THREADS = 10;

/** Maximum number of opportunities to include. */
export const MAX_OPPORTUNITIES = 8;

/** Maximum number of follow-ups to include. */
export const MAX_FOLLOW_UPS = 10;

/** Default relevance weights. */
export const DEFAULT_RELEVANCE_WEIGHTS: RelevanceWeights = {
  keywordOverlap: 30,
  recency: 30,
  relationshipStrength: 20,
  missionAlignment: 20,
};
