import { db } from "@/lib/db/firestore";
import { getProvider } from "@/lib/ai/providers/base";
import { sanitizeFirestore } from "@/lib/utils/sanitize-firestore";
import { publishRCPEvent } from "@/lib/rcp/processor";

export class ChatBackgroundProcessor {
  /**
   * Generates a descriptive title asynchronously based on the first prompt and response.
   */
  static async generateTitle(
    conversationId: string,
    userPrompt: string,
    aiResponse: string
  ) {
    try {
      console.log(`[ChatBackground] Generating title for conversation: ${conversationId}`);
      
      let title: string | null = null;
      const cleanPrompt = userPrompt.trim();

      // Helper to capitalize words
      const capitalizeWords = (str: string) => {
        return str
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      };

      // 1. Rule-based title generation
      // Match Pattern 1: find/search/look for [climate-tech investors] for [Relay AI]
      const findMatch = cleanPrompt.match(/^(?:find|search(?:\s+for)?|look(?:\s+for)?)\s+([^,.]+?)(?:\s+(?:for|in|at)\s+[^,.]+?)?$/i);
      if (findMatch && findMatch[1]) {
        title = capitalizeWords(findMatch[1].trim());
      }

      // Match Pattern 2: draft/write an email to [Tata AIG]
      if (!title) {
        const draftMatch = cleanPrompt.match(/^(?:draft|write)\s+(?:an?\s+)?(?:email|message|outreach)(?:\s+to)?\s+([^,.]+?)$/i);
        if (draftMatch && draftMatch[1]) {
          title = `${capitalizeWords(draftMatch[1].trim())} Outreach`;
        }
      }

      // Match Pattern 3: research/investigate [logistics companies]
      if (!title) {
        const researchMatch = cleanPrompt.match(/^(?:research|investigate|analyze|lookup|look\s+up)\s+([^,.]+?)$/i);
        if (researchMatch && researchMatch[1]) {
          let entity = researchMatch[1].trim();
          entity = entity.replace(/\s+(companies|startups|firms|organizations|corporations)$/i, "");
          title = `${capitalizeWords(entity)} Research`;
        }
      }

      // 2. Fallback to AI-based title generation if no rules match
      if (!title) {
        try {
          const provider = getProvider();
          const systemInstruction = `
            You are a workspace organizer. Based on the user's first prompt: "${userPrompt}"
            and the AI's response: "${aiResponse}", generate a short, clean, descriptive conversation title.
            The title must be 2-5 words. Generate meaningful conversation titles automatically from the user's first prompt.

            Follow these examples:
            - "Find climate-tech investors for Relay AI" → "Climate-Tech Investors"
            - "Draft an email to Tata AIG" → "Tata AIG Outreach"
            - "Research logistics companies" → "Logistics Research"

            Do NOT use generic titles like "Untitled Conversation" or "General Assistance Request".

            You MUST respond ONLY with valid raw JSON matching this schema:
            {
              "title": "Clean Conversation Title"
            }
          `.trim();

          const response = await provider.generate({
            prompt: `Generate a conversation title.`,
            systemInstruction,
            jsonMode: true,
          });

          const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.title && parsed.title.toLowerCase() !== "untitled conversation" && parsed.title.toLowerCase() !== "general assistance request") {
            title = parsed.title;
          }
        } catch (aiErr) {
          console.warn("[ChatBackground] AI title generation failed, falling back to truncation:", aiErr);
        }
      }

      // 3. Fallback to first 40 characters of the prompt
      if (!title) {
        title = cleanPrompt.substring(0, 40) + (cleanPrompt.length > 40 ? "..." : "");
      }

      // 4. Update the conversation title in Firestore
      const titleUpdate = sanitizeFirestore({
        title,
        updatedAt: new Date().toISOString(),
      });

      try {
        await db.collection("conversations").doc(conversationId).update(titleUpdate);
      } catch (error) {
        console.error("Firestore write failed", {
          collection: "conversations",
          documentId: conversationId,
          payload: titleUpdate,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }

      console.log(`[ChatBackground] Successfully updated title to "${title}" for conversation ${conversationId}`);
    } catch (err) {
      console.error("[ChatBackground] Failed to generate conversation title:", err);
      // Absolute fallback if everything fails
      try {
        const fallbackTitle = userPrompt.substring(0, 40) + (userPrompt.length > 40 ? "..." : "");
        const fallbackUpdate = sanitizeFirestore({
          title: fallbackTitle,
          updatedAt: new Date().toISOString(),
        });
        await db.collection("conversations").doc(conversationId).update(fallbackUpdate);
      } catch (fallbackErr) {
        console.error("[ChatBackground] Fallback title update failed:", fallbackErr);
      }
    }
  }

  /**
   * Updates conversation summary and extracts workspace memory entities asynchronously.
   * Capped to run every 5 messages or on the first user/ai turn.
   */
  static async updateSummaryAndMemory(
    userId: string,
    conversationId: string,
    force = false
  ) {
    try {
      const messagesSnap = await db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages")
        .get();

      const messageCount = messagesSnap.size;

      // Trigger summary updates every 5 messages, or if messageCount is exactly 2 (initial user/ai turn), or if forced
      const shouldUpdate = force || messageCount === 2 || messageCount % 5 === 0;

      if (!shouldUpdate) {
        console.log(`[ChatBackground] Skipping summary update (message count is ${messageCount})`);
        return;
      }

      console.log(`[ChatBackground] Updating summary & memory for conversation: ${conversationId}`);

      // 1. Fetch current memory
      const memoryDoc = await db.collection("conversation_memory").doc(conversationId).get();
      const currentMemory = memoryDoc.exists ? memoryDoc.data() || {} : {};

      // 2. Fetch all messages sorted by sequenceNumber
      const allMessagesSnap = await db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages")
        .orderBy("sequenceNumber", "asc")
        .get();

      const messagesText = allMessagesSnap.docs
        .map((doc) => {
          const d = doc.data();
          const role = d.role === "user" ? "User" : "Assistant";
          return `${role}: ${d.content}`;
        })
        .join("\n");

      const provider = getProvider();

      const systemInstruction = `
        You are a workspace memory processor. Based on the current summary: "${currentMemory.summary || ""}"
        and the entire conversation history:
        ${messagesText}

        Perform the following tasks:
        1. Generate a running summary of the conversation. Keep it extremely concise (maximum 3 sentences, e.g., "User is building Dharaa, a climate intelligence platform. Current focus is fundraising and identifying climate-tech investors in India and Southeast Asia.").
        2. Extract key entities mentioned in the chat:
           - goals: active objectives or targets discussed.
           - contacts: names of people mentioned.
           - companies: names of businesses or organizations mentioned.
           - entities: other key general terms or concepts.

        You MUST respond ONLY with valid raw JSON matching this schema:
        {
          "summary": "Updated Running Summary",
          "goals": ["goal 1", "goal 2"],
          "contacts": ["contact name 1"],
          "companies": ["company name 1"],
          "entities": ["entity 1"]
        }
      `.trim();

      const response = await provider.generate({
        prompt: `Extract workspace memory and summarize.`,
        systemInstruction,
        jsonMode: true,
      });

      const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const summary = parsed.summary || "";
      const goals = parsed.goals || [];
      const contacts = parsed.contacts || [];
      const companies = parsed.companies || [];
      const entities = parsed.entities || [];
      const now = new Date().toISOString();

      // Update both conversation document and conversation memory
      const batch = db.batch();
      
      const convRef = db.collection("conversations").doc(conversationId);
      const safeConvUpdate = sanitizeFirestore({
        summary,
        updatedAt: now,
      });
      batch.update(convRef, safeConvUpdate);

      const memRef = db.collection("conversation_memory").doc(conversationId);
      const safeMemSet = sanitizeFirestore({
        conversationId,
        userId,
        summary,
        goals,
        contacts,
        companies,
        entities,
        updatedAt: now,
      });
      batch.set(memRef, safeMemSet, { merge: true });

      try {
        await batch.commit();
      } catch (error) {
        console.error("Firestore batch commit failed", {
          conversationId,
          convPayload: safeConvUpdate,
          memPayload: safeMemSet,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }

      try {
        await publishRCPEvent(userId, "conversation_updated", {
          conversationId,
          goal: goals.length > 0 ? goals[0] : null,
          summary,
          entities: [...contacts, ...companies, ...entities],
        });
      } catch (rcpErr) {
        console.warn("Failed to publish conversation_updated RCP event:", rcpErr);
      }

      console.log(`[ChatBackground] Successfully updated summary and memory for conversation ${conversationId}`);
    } catch (err) {
      console.error("[ChatBackground] Failed to update running summary & memory:", err);
    }
  }
}
