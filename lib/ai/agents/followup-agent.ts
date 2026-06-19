import { getProvider } from "../providers/base";
import { PromptManager } from "../prompts/manager";
import { db } from "@/lib/db/firestore";

export interface FollowUpAgentOutput {
  action: string;
  scheduledAt: string;
  reason: string;
  priority: number;
}

export class FollowUpAgent {
  /**
   * Suggests next follow-up action and timing based on conversation thread and past details.
   */
  static async run(
    userId: string,
    params: {
      contactName: string;
      threadSummary: string;
      followUpHistory: string;
      userGoals: string;
    }
  ): Promise<FollowUpAgentOutput> {
    const { template, version } = PromptManager.getPromptTemplate("followup");

    const prompt = PromptManager.injectParameters(template, {
      contactName: params.contactName,
      threadSummary: params.threadSummary,
      followUpHistory: params.followUpHistory,
      userGoals: params.userGoals,
      currentTime: new Date().toISOString(),
    });

    const provider = getProvider();

    const response = await provider.generate({
      prompt,
      systemInstruction: "You are an expert founder executive assistant. Output ONLY valid raw JSON.",
      jsonMode: true,
    });

    const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as FollowUpAgentOutput;

    // Observability Logging
    try {
      await db.collection("ai_metrics").add({
        userId,
        agentName: "FollowUpAgent",
        model: response.model,
        promptVersion: version,
        latency: response.latency || 0,
        confidence: parsed.priority / 100 || 0.8,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Failed to log follow-up metrics:", err);
    }

    return parsed;
  }
}
export default FollowUpAgent;
