import { getProvider } from "../providers/base";
import { PromptManager } from "../prompts/manager";
import { db } from "@/lib/db/firestore";

export interface BriefingAgentOutput {
  headline: string;
}

export class BriefingAgent {
  /**
   * Summarizes user opportunities status to produce a strategic daily headline.
   */
  static async run(
    userId: string,
    params: {
      userGoals: string;
      pipelineSummary: string;
    }
  ): Promise<BriefingAgentOutput> {
    const { template, version } = PromptManager.getPromptTemplate("briefing");

    const prompt = PromptManager.injectParameters(template, {
      userGoals: params.userGoals,
      pipelineSummary: params.pipelineSummary,
    });

    const provider = getProvider();

    const response = await provider.generate({
      prompt,
      systemInstruction: "You are an autonomous chief of staff. Output ONLY valid raw JSON.",
      jsonMode: true,
    });

    const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as BriefingAgentOutput;

    // Observability Logging
    try {
      await db.collection("ai_metrics").add({
        userId,
        agentName: "BriefingAgent",
        model: response.model,
        promptVersion: version,
        latency: response.latency || 0,
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Failed to log briefing metrics:", err);
    }

    return parsed;
  }
}
export default BriefingAgent;
