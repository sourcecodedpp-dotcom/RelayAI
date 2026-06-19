import { getProvider, getModelConfig } from "../providers/provider-router";
import { db } from "@/lib/db/firestore";
import { ContextAssembler } from "../memory/context-assembler";
import { CommandLogger } from "../memory/command-logger";

export interface CommandRouteResult {
  intent: string;
  action: "redirect" | "display";
  url?: string;
  message: string;
}

export class CommandRouter {
  /**
   * Routes natural language user commands to the correct application workflow.
   */
  static async route(
    userId: string,
    query: string,
    conversationId: string | null = null,
    providerName: string = "system",
    modelName: string = "mercury-2",
    apiKey: string = ""
  ): Promise<any> {
    const provider = getProvider(providerName, apiKey, modelName);
    const modelConfig = getModelConfig(providerName, modelName);

    // ------ Conversation Context Pipeline ------
    let contextBlock = "";
    if (conversationId) {
      try {
        const { ContextBuilder } = await import("@/lib/ai/context-builder");
        const contextData = await ContextBuilder.buildContext(userId, conversationId, modelConfig.maxContextTokens);
        contextBlock = contextData.promptContextBlock;
      } catch (err) {
        console.warn("[CommandRouter] Context assembly failed, continuing without context:", err);
      }
    }

    const systemInstruction = `
      You are the intelligent command router and conversational assistant for Relay AI (an AI-native chief of staff).

      ${contextBlock ? contextBlock : "No mission context available."}\n
      Analyze the user command and categorize it into one of these intents:
      - 'draft_outreach': User wants to write an email, outreach draft, or reply. Extract 'contactName' if mentioned.
      - 'view_briefing': User wants to see daily briefings, dashboard, priorities, summaries of the week.
      - 'view_relationships': User wants to find contacts, see orbits, search investors, see canvas. Extract 'contactName' if mentioned.
      - 'schedule_followup': User wants to set a reminder or schedule a follow-up.
      - 'configure_settings': User wants to set settings, link Google.
      - 'view_gmail': User wants to check their email, Gmail inbox, messages, send an email, sync state.
      - 'view_api': User wants to see diagnostics, API status, system connection states.
      - 'view_profile': User wants to view personal settings, user profile, account details.
      - 'conversational_chat': The user is asking a general question, greeting you, complaining, asking "what the hell is that", asking how things work, requesting text generation, or having a casual chat that is not requesting to navigate to a specific page.

      If the intent is 'conversational_chat':
      - Do NOT suggest redirecting. Set 'actions' to an empty array.
      - Formulate a detailed, conversational, helpful response to their message (like a chat assistant e.g. Antigravity or ChatGPT). Use markdown formatting (like bold, bullet points, headers) to make the text structured and readable.
      - Return the conversational text in the 'summary' and 'data.message' fields.

      You MUST respond ONLY with valid raw JSON matching this schema:
      {
        "success": true,
        "type": "command_result",
        "title": "A concise title of the action (e.g. Outreach Studio, Orbits Canvas, Daily Briefing, or Assistant Chat)",
        "summary": "A short, helpful message summarizing the action to display to the user OR the complete conversational answer to their question if the intent is conversational_chat",
        "actions": [
          {
            "type": "redirect" or "display",
            "url": "placeholder routing path (e.g. /briefing, /outreach, /relationships, /follow-ups, /settings, /gmail, /api, /profile) or null if displaying chat text"
          }
        ],
        "data": {
          "intent": "one of the intent keys listed above",
          "contactName": "Name of contact extracted or null",
          "message": "A short, helpful message summarizing the action OR the complete conversational answer to their question if the intent is conversational_chat"
        }
      }
    `.trim();

    try {
      const response = await provider.generate({
        prompt: `Parse this user command: "${query}"`,
        systemInstruction,
        jsonMode: true,
      });

      const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      // Extract details
      const intent = parsed.data?.intent || parsed.intent || "unknown";
      const contactName = parsed.data?.contactName || parsed.contactName || null;
      let summary = parsed.summary || parsed.message || parsed.data?.message || "";

      console.log(`[STAGE: Intent classified] Intent: ${intent}, ContactName: ${contactName}`);

      // Resolve contact if name is mentioned
      let contactId = "";
      let matchedContactName = "";
      
      if (contactName) {
        console.log(`[STAGE: Context assembled] Querying contacts for matching name: ${contactName}`);
        const snapshot = await db.collection("contacts")
          .where("userId", "==", userId)
          .get();
        
        const match = snapshot.docs.find((doc) => {
          const name = (doc.data().name || "").toLowerCase();
          return name.includes(contactName.toLowerCase()) || contactName.toLowerCase().includes(name);
        });

        if (match) {
          contactId = match.id;
          matchedContactName = match.data().name;
          summary = `Drafting follow-up for ${matchedContactName}...`;
          console.log(`[STAGE: Context assembled] Contact match found: ${matchedContactName} (ID: ${contactId})`);
        } else {
          console.log(`[STAGE: Context assembled] No match found in database for name: ${contactName}`);
        }
      } else {
        console.log("[STAGE: Context assembled] No contact name mentioned in prompt.");
      }

      // Map intents to internal routing URLs
      let targetUrl = "";
      switch (intent) {
        case "draft_outreach":
          targetUrl = contactId ? `/outreach?contactId=${contactId}` : `/outreach`;
          break;
        case "view_briefing":
          targetUrl = "/briefing";
          break;
        case "view_relationships":
          targetUrl = contactId ? `/relationships?contactId=${contactId}` : "/relationships";
          break;
        case "schedule_followup":
          targetUrl = contactId ? `/follow-ups?contactId=${contactId}` : "/follow-ups";
          break;
        case "configure_settings":
          targetUrl = "/settings";
          break;
        case "view_gmail":
          targetUrl = "/gmail";
          break;
        case "view_api":
          targetUrl = "/api";
          break;
        case "view_profile":
          targetUrl = "/profile";
          break;
        case "conversational_chat":
          targetUrl = "";
          break;
        default:
          targetUrl = "";
          break;
      }

      // Construct final routing command result conforming strictly to JSON schema
      const outcomeType = targetUrl ? "redirect" as const : "display" as const;

      const finalResult = {
        success: true,
        type: "command_result" as const,
        title: parsed.title || (intent === "conversational_chat" ? "Assistant Chat" : "Navigation Routing"),
        summary: summary || (targetUrl ? `Navigating to ${targetUrl}` : "Response generated successfully."),
        actions: targetUrl ? [
          {
            type: "redirect" as const,
            url: targetUrl
          }
        ] : [
          {
            type: "display" as const
          }
        ],
        data: {
          intent,
          contactName: contactName || null,
          message: summary || (targetUrl ? `Navigating to ${targetUrl}` : "Response generated successfully.")
        },
        // Legacy fields for backward compatibility with frontend code expecting raw keys
        intent,
        action: outcomeType,
        url: targetUrl || null,
        message: summary || (targetUrl ? `Navigating to ${targetUrl}` : "Response generated successfully.")
      };

      // ------ Log command to command_history (fire-and-forget) ------
      CommandLogger.logCommand(
        userId,
        query,
        conversationId,
        intent,
        outcomeType,
        contactId || null
      );

      return finalResult;
    } catch (err) {
      console.error("CommandRouter routing failed:", err);
      throw err;
    }
  }
}
export default CommandRouter;
