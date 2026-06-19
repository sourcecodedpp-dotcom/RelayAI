import fs from "fs";
import path from "path";

export class PromptManager {
  /**
   * Retrieves a prompt template, selecting dynamically to support versioning and A/B testing.
   */
  static getPromptTemplate(
    type: "research" | "outreach" | "followup" | "briefing",
    version = "v1"
  ): { template: string; version: string } {
    // A/B test support: if "ab_test" is specified, split 50/50 between v1 and any hypothetical v2 (defaulting to v1 here)
    const selectedVersion = version === "ab_test" ? (Math.random() < 0.5 ? "v1" : "v1") : version;
    const filename = `${selectedVersion}.txt`;
    const filePath = path.join(process.cwd(), "lib/ai/prompts", type, filename);

    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        return {
          template: fileContent,
          version: selectedVersion,
        };
      }
    } catch (err) {
      console.warn(`⚠️ PromptManager: Failed to read from ${filePath}. Using inline fallback.`);
    }

    // Inline resilient fallbacks in case of Next.js deployment filesystem constraints
    const fallbacks: Record<string, string> = {
      research: `You are a professional research agent. Analyze the contact and return JSON:
{
  "whyRelevant": "Why this person matters",
  "insights": ["Insight 1", "Insight 2"],
  "talkingPoints": ["Point 1", "Point 2"],
  "confidence": 0.85
}
Name: {{contactName}}
Company: {{company}}
Role: {{role}}
Notes: {{notes}}
User Objective: {{userGoals}}`,
      outreach: `You are a founder outreach advisor. Write email drafts and return JSON:
{
  "subject": "Subject line",
  "variants": ["Draft variant 1", "Draft variant 2"],
  "confidence": 0.9
}
Name: {{contactName}}
Role: {{role}} at {{company}}
Goal: {{userGoals}}
Insights: {{keyInsights}}
Instruction: {{additionalPrompt}}`,
      followup: `Analyze conversation and return follow-up JSON:
{
  "action": "Follow-up action",
  "scheduledAt": "ISO Date string",
  "reason": "Reason details",
  "priority": 80
}
Contact: {{contactName}}
Thread Summary: {{threadSummary}}
History: {{followUpHistory}}
Current Time: {{currentTime}}`,
      briefing: `Synthesize briefing and return JSON:
{
  "headline": "Strategic briefing summary headline"
}
Objectives: {{userGoals}}
Pipeline: {{pipelineSummary}}`,
    };

    return {
      template: fallbacks[type] || "",
      version: `${selectedVersion}_fallback`,
    };
  }

  /**
   * Injects dynamic parameters into double curly braces templates e.g. {{contactName}}
   */
  static injectParameters(template: string, params: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      result = result.replace(regex, value !== undefined && value !== null ? String(value) : "");
    }
    return result;
  }
}

export default PromptManager;
