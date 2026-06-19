export enum RelationshipStatus {
  DISCOVERED = "DISCOVERED",
  CONTACTED = "CONTACTED",
  RESPONDED = "RESPONDED",
  WARM = "WARM",
  COLD = "COLD",
}

export enum FollowUpStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  SCHEDULED = "SCHEDULED",
}

export enum OpportunityType {
  FOLLOW_UP_DUE = "FOLLOW_UP_DUE",
  INVESTOR_REPLIED = "INVESTOR_REPLIED",
  NEW_CONTACT_DISCOVERED = "NEW_CONTACT_DISCOVERED",
}

export enum OpportunityStatus {
  PENDING = "PENDING",
  DISMISSED = "DISMISSED",
  COMPLETED = "COMPLETED",
}

export enum OpportunityPriority {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum AuditAction {
  EMAIL_GENERATED = "EMAIL_GENERATED",
  EMAIL_SENT = "EMAIL_SENT",
  OAUTH_EVENT = "OAUTH_EVENT",
  GOAL_UPDATE = "GOAL_UPDATE",
  FOLLOW_UP_ACTION = "FOLLOW_UP_ACTION",
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  onboardingCompleted: boolean;
  primaryUseCase?: string | null;
  outreachGoals?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mission Context Engine Types
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

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  status: "active" | "archived";
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, any>;
  sequenceNumber: number;
  createdAt: string;
}

export interface ConversationMemory {
  conversationId: string;
  userId: string;
  summary: string;
  entities: string[];
  goals: string[];
  contacts: string[];
  companies: string[];
  updatedAt: string;
}

