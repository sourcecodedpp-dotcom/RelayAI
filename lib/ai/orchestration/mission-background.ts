import { db } from "@/lib/db/firestore";
import { getProvider } from "../providers/base";
import { sanitizeFirestore } from "@/lib/utils/sanitize-firestore";

export class MissionBackgroundProcessor {
  /**
   * Generates a title and initial summary for a newly created mission based on the first prompt and response.
   * Runs in the background to avoid blocking user redirects.
   */
  static async generateTitleAndSummary(
    userId: string,
    missionId: string,
    commandText: string,
    aiOutputText: string
  ) {
    try {
      const provider = getProvider();
      
      const systemInstruction = `
        You are a workspace manager. Based on the user's first command: "${commandText}"
        and the AI's initial response: "${aiOutputText}", generate:
        1. A short, concise mission title (maximum 5 words, e.g., "Dharaa Fundraising" or "Riddhiraj Contact Outreach").
        2. A short initial workspace summary (maximum 2-3 sentences).

        You MUST respond ONLY with valid raw JSON matching this schema:
        {
          "title": "Concise Mission Title",
          "summary": "Short initial running summary of the workspace."
        }
      `.trim();

      const response = await provider.generate({
        prompt: `Generate title and summary for the workspace.`,
        systemInstruction,
        jsonMode: true,
      });

      const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const title = parsed.title || "Untitled Mission";
      const summary = parsed.summary || "";

      await db.collection("missions").doc(missionId).update({
        title,
        summary,
        currentSummary: summary,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[MissionBackground] Successfully generated title "${title}" and initial summary for mission ${missionId}`);
    } catch (err) {
      console.error("[MissionBackground] Failed to generate title and summary:", err);
      // Fallback: update with a simple description
      try {
        await db.collection("missions").doc(missionId).update({
          title: commandText.substring(0, 30) + (commandText.length > 30 ? "..." : ""),
          updatedAt: new Date().toISOString(),
        });
      } catch (fallbackErr) {
        console.error("[MissionBackground] Fallback update failed:", fallbackErr);
      }
    }
  }

  /**
   * Updates the running summary of the workspace based on the full event history.
   * Runs asynchronously in the background.
   */
  static async updateMissionSummary(userId: string, missionId: string) {
    try {
      // 1. Fetch mission details
      const missionDoc = await db.collection("missions").doc(missionId).get();
      if (!missionDoc.exists) return;
      const missionData = missionDoc.data() || {};

      // 2. Fetch recent events (retrieve up to 50 latest events to generate context summary)
      const eventsSnap = await db.collection("mission_events")
        .where("missionId", "==", missionId)
        .where("userId", "==", userId)
        .get();

      const events = eventsSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          type: d.type,
          content: d.content,
          createdAt: d.createdAt,
          sequenceNumber: d.sequenceNumber,
        };
      });

      // Sort chronological
      events.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

      const provider = getProvider();

      const systemInstruction = `
        You are a workspace manager. Based on the mission title: "${missionData.title}",
        the current summary: "${missionData.currentSummary || ""}", and the list of workspace events below:
        ${JSON.stringify(events.slice(-30))}

        Generate an updated running summary of what has been accomplished in this workspace.
        Keep it extremely concise (maximum 3 sentences, e.g., "Dharaa fundraising mission focused on climate-tech investors in India and Southeast Asia. Five investors identified. Two outreach emails sent. One follow-up pending.").

        You MUST respond ONLY with valid raw JSON matching this schema:
        {
          "currentSummary": "Updated summary here"
        }
      `.trim();

      const response = await provider.generate({
        prompt: `Update the running workspace summary.`,
        systemInstruction,
        jsonMode: true,
      });

      const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.currentSummary) {
        const summaryUpdate = sanitizeFirestore({
          currentSummary: parsed.currentSummary,
          updatedAt: new Date().toISOString(),
        });
        try {
          await db.collection("missions").doc(missionId).update(summaryUpdate);
        } catch (error) {
          console.error("Firestore write failed", {
            collection: "missions",
            documentId: missionId,
            payload: summaryUpdate,
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
        console.log(`[MissionBackground] Updated summary for mission ${missionId}: "${parsed.currentSummary}"`);
      }
    } catch (err) {
      console.error("[MissionBackground] Failed to update running summary:", err);
    }
  }

  /**
   * Atomically increments the eventCount of a mission, logs the event in mission_events,
   * and updates lastActivityAt of the mission.
   */
  static async logEvent(
    userId: string,
    missionId: string,
    type: "command" | "ai_output" | "opportunity" | "contact" | "follow_up" | "gmail_thread",
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<number> {
    try {
      const missionRef = db.collection("missions").doc(missionId);
      let sequenceNumber = 1;

      // Atomic transaction to increment sequence number
      try {
        await db.runTransaction(async (transaction) => {
          const missionDoc = await transaction.get(missionRef);
          if (missionDoc.exists) {
            const currentCount = missionDoc.data()?.eventCount || 0;
            sequenceNumber = currentCount + 1;
            const updatePayload = sanitizeFirestore({
              eventCount: sequenceNumber,
              lastActivityAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            transaction.update(missionRef, updatePayload);
          } else {
            // If the mission document is being created or doesn't have fields yet
            const setPayload = sanitizeFirestore({
              eventCount: 1,
              lastActivityAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            transaction.set(missionRef, setPayload, { merge: true });
          }
        });
      } catch (error) {
        console.error("Firestore transaction write failed", {
          collection: "missions",
          documentId: missionId,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }

      const eventRef = db.collection("mission_events").doc();
      const sanitizedMetadata = sanitizeFirestore(metadata);
      const eventData = sanitizeFirestore({
        missionId,
        userId,
        type,
        content,
        metadata: sanitizedMetadata,
        sequenceNumber,
        createdAt: new Date().toISOString(),
      });
      try {
        await eventRef.set(eventData);
      } catch (error) {
        console.error("Firestore write failed", {
          collection: "mission_events",
          documentId: eventRef.id,
          payload: eventData,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }

      console.log(`[MissionEvents] Logged event of type "${type}" for mission ${missionId} (sequence: ${sequenceNumber})`);
      return sequenceNumber;
    } catch (err) {
      console.error("[MissionEvents] Failed to log mission event:", err);
      return 0;
    }
  }
}
