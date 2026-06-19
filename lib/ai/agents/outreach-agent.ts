import { getProvider } from "../providers/base";
import { PromptManager } from "../prompts/manager";
import { db } from "@/lib/db/firestore";

export interface OutreachAgentOutput {
  subject: string;
  variants: string[];
  confidence: number;
}

export class OutreachAgent {
  /**
   * Generates personalized outreach drafts with multiple variants.
   */
  static async run(
    userId: string,
    params: {
      contactName: string;
      role: string;
      company: string;
      notes?: string;
      userGoals: string;
      companyInfo?: string;
      professionalBackground?: string;
      keyInsights?: string;
      recentNews?: string;
      additionalPrompt?: string;
    }
  ): Promise<OutreachAgentOutput> {
    const { template, version } = PromptManager.getPromptTemplate("outreach");

    const prompt = PromptManager.injectParameters(template, {
      contactName: params.contactName,
      role: params.role,
      company: params.company,
      notes: params.notes || "None",
      userGoals: params.userGoals,
      companyInfo: params.companyInfo || "None",
      professionalBackground: params.professionalBackground || "None",
      keyInsights: params.keyInsights || "None",
      recentNews: params.recentNews || "None",
      additionalPrompt: params.additionalPrompt || "Write standard personal founder outreach.",
    });

    const provider = getProvider();

    const response = await provider.generate({
      prompt,
      systemInstruction: "You are a professional startup founder email advisor. Output ONLY valid raw JSON.",
      jsonMode: true,
    });

    const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as OutreachAgentOutput;

    // Observability Logging
    try {
      await db.collection("ai_metrics").add({
        userId,
        agentName: "OutreachAgent",
        model: response.model,
        promptVersion: version,
        latency: response.latency || 0,
        confidence: parsed.confidence || 0.85,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Failed to log outreach metrics:", err);
    }

    return parsed;
  }
}
export default OutreachAgent;
