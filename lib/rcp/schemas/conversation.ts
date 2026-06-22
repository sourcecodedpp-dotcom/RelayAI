import { ConversationRCP } from "../types";

export const DEFAULT_CONVERSATION_RCP = (conversationId: string): ConversationRCP => ({
  version: "1.0",
  conversationId,
  updatedAt: new Date().toISOString(),
  entities: [],
  recentActions: [],
});

export function validateConversationRCP(data: any, conversationId: string): ConversationRCP {
  return {
    version: "1.0",
    conversationId: data?.conversationId || conversationId,
    updatedAt: data?.updatedAt || new Date().toISOString(),
    goal: data?.goal || undefined,
    summary: data?.summary || undefined,
    entities: Array.isArray(data?.entities) ? data.entities : [],
    recentActions: Array.isArray(data?.recentActions) ? data.recentActions : [],
  };
}
