export type RCPEventType =
  | "email_sent"
  | "email_received"
  | "contact_created"
  | "contact_updated"
  | "opportunity_created"
  | "follow_up_created"
  | "follow_up_completed"
  | "conversation_updated"
  | "profile_updated";

export interface RCPEvent {
  id: string;
  type: RCPEventType;
  userId: string;
  timestamp: string;
  data: any;
}

export interface GlobalRCP {
  version: "1.0";
  updatedAt: string;

  profile: {
    startup?: string;
    description?: string;
    targetAudience?: string[];
  };

  gmail: {
    unreadCount: number;
    followUpsDue: number;
    lastOutreach?: string;
  };

  contacts: {
    topProspects: string[];
    status?: Record<string, string>;
  };

  opportunities: {
    active: number;
  };

  followUps?: {
    pending?: string[];
  };
}

export interface ConversationRCP {
  version: "1.0";
  conversationId: string;
  updatedAt: string;
  goal?: string;
  summary?: string;
  entities: string[];
  recentActions: string[];
}
