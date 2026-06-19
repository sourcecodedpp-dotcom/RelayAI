import { PromptManager } from "../lib/ai/prompts/manager";
import { MockProvider } from "../lib/ai/providers/mock";
import { ResearchAgent } from "../lib/ai/agents/research-agent";
import { OutreachAgent } from "../lib/ai/agents/outreach-agent";
import { FollowUpAgent } from "../lib/ai/agents/followup-agent";
import { BriefingAgent } from "../lib/ai/agents/briefing-agent";
import { CommandRouter } from "../lib/ai/orchestration/command-router";

// Force MOCK AI provider for deterministic evaluation testing
process.env.AI_PROVIDER = "mock";
// Set dummy firebase credentials to avoid startup proxy checks throwing errors
process.env.FIREBASE_PROJECT_ID = "mock-project";
process.env.FIREBASE_CLIENT_EMAIL = "mock-client@test.com";
process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----";
process.env.AUTH_SECRET = "dummy-auth-secret-longer-than-32-chars-for-validation";
process.env.ENCRYPTION_KEY = "dummy-encryption-key-longer-than-32-chars";
process.env.GOOGLE_CLIENT_ID = "dummy";
process.env.GOOGLE_CLIENT_SECRET = "dummy";
process.env.MERCURY_API_KEY = "dummy";

async function runEvaluations() {
  console.log("🚀 Starting Relay AI Agent Evaluation Tests...\n");
  let passedTests = 0;
  let failedTests = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failedTests++;
    }
  };

  // Test 1: Prompt Manager Parameter Injection
  try {
    const template = "Hello {{name}}, welcome to {{company}}.";
    const result = PromptManager.injectParameters(template, { name: "Alice", company: "Relay" });
    assert(result === "Hello Alice, welcome to Relay.", "PromptManager injects parameters correctly.");
  } catch (err: any) {
    assert(false, `PromptManager injection failed: ${err.message}`);
  }

  // Test 2: Mock Provider Response
  try {
    const provider = new MockProvider();
    const res = await provider.generate({ prompt: "research contact" });
    const data = JSON.parse(res.text);
    assert(data.whyRelevant !== undefined, "MockProvider returns structured JSON data.");
  } catch (err: any) {
    assert(false, `MockProvider generation failed: ${err.message}`);
  }

  // Test 3: Research Agent Output schema & Hallucination Guard
  try {
    const result = await ResearchAgent.run("test_user", {
      contactName: "Alex Mercer",
      company: "Aether",
      role: "CEO",
      notes: "Met at TechCrunch",
      userGoals: "Recruiting seed co-founders",
    });
    assert(
      result.whyRelevant !== undefined &&
      Array.isArray(result.insights) &&
      Array.isArray(result.talkingPoints) &&
      typeof result.confidence === "number",
      "ResearchAgent returns valid schema matching expected types."
    );
  } catch (err: any) {
    assert(false, `ResearchAgent test failed: ${err.message}`);
  }

  // Test 4: Outreach Agent Variants & Consent Safety
  try {
    const result = await OutreachAgent.run("test_user", {
      contactName: "Sarah Chen",
      role: "Partner",
      company: "Sequoia",
      userGoals: "Raise $1.5M funding",
    });
    assert(
      result.subject !== undefined &&
      Array.isArray(result.variants) &&
      result.variants.length >= 2,
      "OutreachAgent generates multiple email draft variants."
    );
  } catch (err: any) {
    assert(false, `OutreachAgent test failed: ${err.message}`);
  }

  // Test 5: Follow-Up Agent scheduling & Stale Conversation detection
  try {
    const result = await FollowUpAgent.run("test_user", {
      contactName: " Sarah Chen",
      threadSummary: "No reply received for 7 days after first email.",
      followUpHistory: "Email 1 sent on Monday.",
      userGoals: "Raise funding.",
    });
    assert(
      result.action !== undefined &&
      typeof result.priority === "number" &&
      result.scheduledAt !== undefined,
      "FollowUpAgent schedules re-engagement actions based on stale threads."
    );
  } catch (err: any) {
    assert(false, `FollowUpAgent test failed: ${err.message}`);
  }

  // Test 6: Briefing Agent Headline summary
  try {
    const result = await BriefingAgent.run("test_user", {
      userGoals: "Raise seed funding.",
      pipelineSummary: "Opportunity: reply from Sarah Chen",
    });
    assert(
      typeof result.headline === "string" && result.headline.length > 0,
      "BriefingAgent synthesizes strategic briefing headlines."
    );
  } catch (err: any) {
    assert(false, `BriefingAgent test failed: ${err.message}`);
  }

  // Test 7: Command Router natural language parsing
  try {
    const result = await CommandRouter.route("test_user", "Draft a follow-up for Sarah Chen");
    assert(
      result.intent === "draft_outreach" && result.action === "redirect",
      "CommandRouter maps natural language commands to draft outreach flow."
    );
  } catch (err: any) {
    assert(false, `CommandRouter test failed: ${err.message}`);
  }

  console.log(`\n📊 Evaluation summary: ${passedTests} passed, ${failedTests} failed.`);
  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log("🎉 All AI native agent evaluations completed successfully.");
    process.exit(0);
  }
}

runEvaluations().catch((err) => {
  console.error("❌ Fatal runner failure:", err);
  process.exit(1);
});
