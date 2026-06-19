import { AiProvider, GenerateParams, AiResponse } from "./base";

export class MockProvider implements AiProvider {
  async generate(params: GenerateParams): Promise<AiResponse> {
    const systemLower = (params.systemInstruction || "").toLowerCase();
    const promptLower = params.prompt.toLowerCase();
    const startTime = Date.now();

    let text = "";

    if (systemLower.includes("navigation") || systemLower.includes("router") || promptLower.includes("command")) {
      const isConversational = !promptLower.includes("draft") && 
                               !promptLower.includes("sarah") && 
                               !promptLower.includes("priority") && 
                               !promptLower.includes("briefing") && 
                               !promptLower.includes("relationships") &&
                               !promptLower.includes("canvas") &&
                               !promptLower.includes("follow") &&
                               !promptLower.includes("settings") &&
                               !promptLower.includes("gmail") &&
                               !promptLower.includes("api") &&
                               !promptLower.includes("profile");

      if (isConversational) {
        text = JSON.stringify({
          success: true,
          type: "command_result",
          title: "Assistant Chat",
          summary: "Hello! I am Relay AI, your chief of staff assistant. How can I help you today?\n\nYou can use commands like:\n- **Draft outreach to Sarah Chen** to write emails.\n- **Show priorities** or **daily briefing** to check updates.\n- **View orbits** or **relationships** to check your contact canvas.",
          actions: [],
          data: {
            intent: "conversational_chat",
            contactName: null,
            message: "Hello! I am Relay AI, your chief of staff assistant. How can I help you today?\n\nYou can use commands like:\n- **Draft outreach to Sarah Chen** to write emails.\n- **Show priorities** or **daily briefing** to check updates.\n- **View orbits** or **relationships** to check your contact canvas."
          }
        });
      } else if (promptLower.includes("sarah") || promptLower.includes("draft")) {
        text = JSON.stringify({
          intent: "draft_outreach",
          contactName: "Sarah Chen",
          message: "Routing you to draft outreach for Sarah Chen.",
        });
      } else if (promptLower.includes("priority") || promptLower.includes("briefing")) {
        text = JSON.stringify({
          intent: "view_briefing",
          contactName: null,
          message: "Navigating to your daily Briefing Feed.",
        });
      } else {
        text = JSON.stringify({
          intent: "view_relationships",
          contactName: null,
          message: "Navigating to your Relationships Canvas.",
        });
      }
    }
    // 2. Briefing Agent Check
    else if (systemLower.includes("chief of staff") || systemLower.includes("briefing")) {
      text = JSON.stringify({
        headline: "High momentum today: 2 warm replies and 1 new priority follow-up.",
        opportunities: [],
      });
    }
    // 3. Outreach Agent Check
    else if (systemLower.includes("email") || systemLower.includes("outreach") || promptLower.includes("outreach")) {
      text = JSON.stringify({
        subject: "Quick question on deep-tech DevOps orchestration",
        variants: [
          "Hi, I saw your recent investment in the DevOps space. We're building Relay to automate chief of staff workflows. Would love to share our thoughts on autonomous orchestration.",
          "Hello, followed your writing on developer infrastructure. We are building Relay, an AI-native relationship engine for startup founders. Would value 10 minutes to sync.",
        ],
        confidence: 0.88,
      });
    }
    // 4. Follow-up Agent Check
    else if (systemLower.includes("executive assistant") || systemLower.includes("follow-up")) {
      text = JSON.stringify({
        action: "Send re-engagement email with the product update deck",
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        reason: "Contact has not replied in 7 days, and is a high-alignment investor.",
        priority: 85,
      });
    }
    // 5. Research Agent Check
    else if (systemLower.includes("research") || promptLower.includes("research")) {
      text = JSON.stringify({
        whyRelevant: "Highly active in deep-tech seed investments and fits your target size.",
        insights: [
          "Focus on your unique API orchestration layer.",
          "Mention their recent portfolio addition in DevOps space.",
        ],
        talkingPoints: [
          "Congratulations on the DevOps investment.",
          "Discussing Relay's autonomous agent orchestration capability.",
        ],
        confidence: 0.92,
      });
    }
    // 6. Prioritization Agent Check
    else if (systemLower.includes("priority") || systemLower.includes("priorit") || promptLower.includes("score")) {
      text = JSON.stringify({
        score: 87,
        confidence: 0.9,
        reasons: ["Strong goal alignment", "High response likelihood in this industry"],
      });
    }
    // Fallback default response
    else {
      text = JSON.stringify({
        message: "Mock provider fallback response.",
        success: true,
      });
    }

    const latency = Date.now() - startTime;

    return {
      text,
      latency,
      model: "mock-model",
    };
  }
}
export default MockProvider;
