import { db } from "@/lib/db/firestore";
import { MemoryService } from "@/lib/ai/memory/memory";
import { Message, ConversationMemory } from "@/types";

export interface StructuredContext {
  promptContextBlock: string;
  recentMessagesText: string;
  summary: string;
}

export class ContextBuilder {
  /**
   * Builds the prioritized context block for the AI.
   * Context Priority:
   * 1. Conversation summary (from memory)
   * 2. User goals
   * 3. Recent 15 messages (chronological order)
   * 4. Important entities (contacts & companies)
   * 5. Gmail insights & Opportunities
   */
  static async buildContext(
    userId: string,
    conversationId: string,
    maxContextTokens: number = 80000
  ): Promise<StructuredContext> {
    console.log(`[ContextBuilder] Assembling context for conversation: ${conversationId} with maxContextTokens: ${maxContextTokens}`);

    // 1. Fetch conversation memory
    let memory: ConversationMemory | null = null;
    try {
      const memDoc = await db.collection("conversation_memory").doc(conversationId).get();
      if (memDoc.exists) {
        memory = memDoc.data() as ConversationMemory;
      }
    } catch (err) {
      console.warn("[ContextBuilder] Failed to load conversation memory:", err);
    }

    const conversationSummary = memory?.summary || "No summary available yet for this conversation.";

    // 2. Fetch last 15 messages sorted by sequenceNumber ascending
    let messages: Message[] = [];
    try {
      const messagesSnap = await db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages")
        .orderBy("sequenceNumber", "desc")
        .limit(15)
        .get();

      messages = messagesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      // Reverse to chronological order (ASC)
      messages.reverse();
    } catch (err) {
      console.warn("[ContextBuilder] Failed to load messages history:", err);
    }

    // Format recent messages for both context inclusion and summary updates
    const formattedMessages = messages.map((m) => {
      const roleName = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
      return `${roleName}: ${m.content}`;
    });
    const recentMessagesText = formattedMessages.join("\n");

    // 3. Fetch user profile & goals
    let userProfile = "";
    let goals: any[] = [];
    try {
      userProfile = await MemoryService.getUserProfile(userId);
      // Retrieve goals (passing null for missionId to get all active user goals)
      goals = await MemoryService.getGoals(userId, null);
    } catch (err) {
      console.warn("[ContextBuilder] Failed to load user profile/goals:", err);
    }

    const goalsText = goals.map((g) => `- ${g.title}: ${g.description}`).join("\n");

    // 4. Fetch contacts & companies
    let contacts: any[] = [];
    let companies: any[] = [];
    try {
      contacts = await MemoryService.getRelevantContacts(userId, null, 10);
      companies = await MemoryService.getRelevantCompanies(userId, null);
    } catch (err) {
      console.warn("[ContextBuilder] Failed to load contacts/companies:", err);
    }

    const contactsText = contacts
      .map((c) => `- ${c.name} (${c.role} at ${c.company}). Status: ${c.relationshipStatus}. Notes: ${c.notes}`)
      .join("\n");

    const companiesText = companies
      .map((cp) => `- ${cp.name}. Info: ${cp.info || "No description"}. Contacts: ${cp.contactNames.join(", ")}`)
      .join("\n");

    // 5. Fetch Gmail metadata & Opportunities
    let opportunities: any[] = [];
    let gmailThreads: any[] = [];
    try {
      opportunities = await MemoryService.getRecentOpportunities(userId, 8);
      const contactIds = contacts.map((c) => c.id);
      if (contactIds.length > 0) {
        gmailThreads = await MemoryService.getGmailContext(userId, contactIds);
      }
    } catch (err) {
      console.warn("[ContextBuilder] Failed to load gmail/opportunities:", err);
    }

    const oppsText = opportunities
      .map((o) => `- [Opportunity] ${o.title}: ${o.description} (${o.priority}, Priority Score: ${o.score})`)
      .join("\n");

    const gmailText = gmailThreads
      .map((t) => `- [Email Subject] "${t.subject}" [Status: ${t.status}] (Last Updated: ${t.updatedAt})`)
      .join("\n");

    // Adapt context assembly based on maxContextTokens
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    // Budget can be up to 40% of max context window (capped at 16,000 for efficiency/latency)
    const tokenBudget = Math.min(Math.floor(maxContextTokens * 0.4), 16000);

    let totalTokens = 0;
    const contextSections: string[] = [];

    contextSections.push("=== CONVERSATION WORKSPACE CONTEXT ===");
    totalTokens += estimateTokens(contextSections[0]);

    // Priority 1: Conversation Summary
    const summarySection = `\n## Workspace Summary\n${conversationSummary}`;
    if (totalTokens + estimateTokens(summarySection) <= tokenBudget) {
      contextSections.push(summarySection);
      totalTokens += estimateTokens(summarySection);
    }

    // Priority 2: User Profile & Goals
    const profileSection = `\n## User Profile\n${userProfile}`;
    if (totalTokens + estimateTokens(profileSection) <= tokenBudget) {
      contextSections.push(profileSection);
      totalTokens += estimateTokens(profileSection);
    }

    if (goalsText) {
      const goalsSection = `\n## User Goals\n${goalsText}`;
      if (totalTokens + estimateTokens(goalsSection) <= tokenBudget) {
        contextSections.push(goalsSection);
        totalTokens += estimateTokens(goalsSection);
      }
    }

    // Priority 3: Recent Messages (chronological order, built backwards to fit token budget)
    let includedMessagesText = "";
    if (messages.length > 0) {
      const msgsToInclude: string[] = [];
      let msgsTokens = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        const roleName = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
        const formatted = `${roleName}: ${m.content}`;
        const msgTokens = estimateTokens(formatted) + 1; // +1 for newline character

        if (totalTokens + msgsTokens + msgTokens > tokenBudget) {
          break;
        }

        msgsToInclude.unshift(formatted); // prepend to keep chronological order
        msgsTokens += msgTokens;
      }

      if (msgsToInclude.length > 0) {
        includedMessagesText = msgsToInclude.join("\n");
        const historySection = `\n## Recent Conversation History\n${includedMessagesText}`;
        contextSections.push(historySection);
        totalTokens += estimateTokens(historySection);
      }
    }

    // Priority 4: Important Entities (Contacts & Companies)
    if (contactsText && totalTokens < tokenBudget) {
      const contactsSection = `\n## Relevant Contacts\n${contactsText}`;
      if (totalTokens + estimateTokens(contactsSection) <= tokenBudget) {
        contextSections.push(contactsSection);
        totalTokens += estimateTokens(contactsSection);
      }
    }
    if (companiesText && totalTokens < tokenBudget) {
      const companiesSection = `\n## Relevant Companies\n${companiesText}`;
      if (totalTokens + estimateTokens(companiesSection) <= tokenBudget) {
        contextSections.push(companiesSection);
        totalTokens += estimateTokens(companiesSection);
      }
    }

    // Priority 5: Gmail insights & Opportunities
    if (oppsText && totalTokens < tokenBudget) {
      const oppsSection = `\n## Pending Opportunities\n${oppsText}`;
      if (totalTokens + estimateTokens(oppsSection) <= tokenBudget) {
        contextSections.push(oppsSection);
        totalTokens += estimateTokens(oppsSection);
      }
    }
    if (gmailText && totalTokens < tokenBudget) {
      const gmailSection = `\n## Recent Email Communications\n${gmailText}`;
      if (totalTokens + estimateTokens(gmailSection) <= tokenBudget) {
        contextSections.push(gmailSection);
        totalTokens += estimateTokens(gmailSection);
      }
    }

    contextSections.push("\n=== END CONVERSATION WORKSPACE CONTEXT ===");

    return {
      promptContextBlock: contextSections.join("\n"),
      recentMessagesText: includedMessagesText || recentMessagesText,
      summary: conversationSummary,
    };
  }
}
