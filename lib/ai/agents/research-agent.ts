import { getProvider } from "../providers/base";
import { PromptManager } from "../prompts/manager";
import { db } from "@/lib/db/firestore";

export interface ResearchAgentOutput {
  whyRelevant: string;
  insights: string[];
  talkingPoints: string[];
  confidence: number;
}

export class ResearchAgent {
  /**
   * Runs deep AI research on a contact profile.
   */
  static async run(
    userId: string,
    params: {
      contactName: string;
      company: string;
      role: string;
      notes?: string;
      userGoals: string;
    }
  ): Promise<ResearchAgentOutput> {
    const { template, version } = PromptManager.getPromptTemplate("research");
    
    const prompt = PromptManager.injectParameters(template, {
      contactName: params.contactName,
      company: params.company,
      role: params.role,
      notes: params.notes || "None",
      userGoals: params.userGoals,
    });

    const provider = getProvider();
    
    const response = await provider.generate({
      prompt,
      systemInstruction: "You are an expert startup research agent. Output ONLY valid raw JSON.",
      jsonMode: true,
    });

    // Clean any potential markdown code fences from completions
    const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ResearchAgentOutput;

    // Observability Logging
    try {
      await db.collection("ai_metrics").add({
        userId,
        agentName: "ResearchAgent",
        model: response.model,
        promptVersion: version,
        latency: response.latency || 0,
        confidence: parsed.confidence || 0.8,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Failed to log research metrics:", err);
    }

    return parsed;
  }
}
export default ResearchAgent;
