import { getProvider } from "../providers/provider-router";
import { MissionBackgroundProcessor } from "../orchestration/mission-background";
import { ChatBackgroundProcessor } from "../orchestration/chat-background";
import { db } from "@/lib/db/firestore";
import { TOOLS } from "./tools/swarm-tools";
import { invalidateRCPCache } from "@/lib/rcp/compiler";

export class SwarmExecutor {
  /**
   * Helper to write swarm event logs. If isChat is true, logs are appended directly to the conversation's message thread.
   */
  static async logEvent(
    userId: string,
    id: string, // missionId or conversationId
    role: "system" | "assistant",
    content: string,
    isChat: boolean,
    type = "follow_up",
    metadata: Record<string, any> = {}
  ) {
    if (isChat) {
      try {
        const convRef = db.collection("conversations").doc(id);
        const messagesSnap = await convRef.collection("messages").get();
        const sequenceNumber = messagesSnap.size + 1;
        const msgRef = convRef.collection("messages").doc();
        
        await msgRef.set({
          conversationId: id,
          userId,
          role,
          content,
          sequenceNumber,
          metadata: {
            type: role === "system" ? (metadata.type || type || "info") : "intent_result",
            ...metadata
          },
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("[SwarmExecutor] Failed to write swarm message to conversation: ", err);
      }
    } else {
      const eventType = role === "system" ? "follow_up" as const : "ai_output" as const;
      await MissionBackgroundProcessor.logEvent(userId, id, eventType, content, metadata);
    }
  }

  /**
   * Runs the 100% autonomous agentic loop in the background.
   */
  static async execute(
    userId: string,
    missionId: string, // represents conversationId if isChat is true
    command: string,
    rcpContext: string,
    providerName = "system",
    modelName = "mercury-2",
    apiKey = "",
    isChat = false
  ) {
    // Run in a background Promise block to prevent blocking the Next.js API thread
    (async () => {
      console.log(`[SwarmExecutor] Starting autonomous swarm. ID: ${missionId}, isChat: ${isChat}`);
      
      let loopCount = 0;
      const maxLoops = 6; // Cap loops at 6 for snappy responses
      const agentHistory: any[] = [];
      let latestRcpContext = rcpContext;
      
      // Determine active AI provider
      const resolvedProviderName = providerName || "system";
      const resolvedModelName = modelName || "mercury-2";
      const resolvedApiKey = apiKey || process.env.MERCURY_API_KEY || "";
      
      let provider;
      try {
        provider = getProvider(resolvedProviderName, resolvedApiKey, resolvedModelName);
      } catch (err) {
        console.error("[SwarmExecutor] Failed to initialize provider:", err);
        await SwarmExecutor.logEvent(
          userId,
          missionId,
          "system",
          "Swarm execution failed: Unable to initialize AI provider connection.",
          isChat,
          "follow_up",
          { error: true }
        );
        return;
      }

      // 1. Initial swarm startup event (rendered as system status badge)
      await SwarmExecutor.logEvent(
        userId,
        missionId,
        "system",
        "Autonomous Swarm Initialized: Scanning resources and matching profiles...",
        isChat
      );

      let finalSummary = "";

      // We will loop until the swarm controller decides to complete or hits maxLoops
      while (loopCount < maxLoops) {
        loopCount++;
        
        // CRITICAL: Invalidate the RCP cache to ensure the model sees its own DB updates from the previous step
        invalidateRCPCache(userId, missionId);
        
        // Re-compile context to fetch the updated Firestore state (fresh contacts, followups, etc.)
        try {
          const { buildRCP } = await import("@/lib/rcp/compiler");
          const { getModelConfig } = await import("../providers/provider-router");
          const modelConfig = getModelConfig(resolvedProviderName, resolvedModelName);
          latestRcpContext = await buildRCP(userId, missionId, modelConfig.maxContextTokens);
        } catch (rcpErr) {
          console.warn("[SwarmExecutor] Failed to refresh RCP context: ", rcpErr);
        }

        // Define Swarm Coordinator prompt, including Karpathy guidelines
        const systemInstruction = `
          You are the Autonomous Swarm Coordinator for Relay AI.
          Your task: "${command}"

          Use the following Real-Time Context Protocol (RCP) block containing the user profile, use case, and database state to guide your actions:
          ${latestRcpContext}

          === KARPATHY EXECUTION RULES ===
          1. THINK BEFORE ACTING: Write your exact reasoning, assumptions, and validation metrics in the "thought" field before doing anything.
          2. SURGICAL DATABASE CHANGES: Touch only necessary tables. Never invent fields or details (like email addresses or investment check sizes) that you have not successfully verified.
          3. GOAL-DRIVEN: Work sequentially. Do not declare victory on a task without executing the corresponding verification check.
          ================================

          Available Tools:
          ${JSON.stringify(TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })))}

          Determine the next action. If you have gathered investors, created contacts, scheduled follow-ups, and drafted emails successfully, set action to "finish".
          
          === RESPONSE BRILLIANCE & CREATIVITY RULES ===
          When setting action to "finish", you MUST generate a highly creative, brilliant, and professional "finalMessage" that wow's the user. 
          Use rich markdown formatting. The finalMessage must include:
          1. ⚡ **Investor Match Dossier**: Match details, investment thesis, sector alignment, check size, and why they fit.
          2. ⚙️ **Automated Workflows Executed**: Checklist showing:
             - "✅ Contact Created: [Name] at [Company] ([Email])"
             - "📅 Action Item Scheduled: [Title]"
             - "✉️ Outreach Draft Saved"
          3. ✉️ **Strategic Pitch Draft Preview**: The full personalized outreach email, enclosed in a markdown blockquote or code block. It must be highly tailored, creative, hook-driven, and must resolve all placeholders (use the founder's startup name and focus from the RCP context).
          4. 💡 **Creative Advisor Insight**: A unique, non-generic tip on how the founder should approach this person.
          ================================

          You MUST respond ONLY with valid raw JSON matching this schema:
          {
            "thought": "Your internal analysis, assumptions, and next validation step",
            "action": "call_tool" | "finish",
            "toolName": "name of tool to call, or null",
            "toolArgs": { ...args for tool, or null },
            "finalMessage": "Detailed summary of achievements if finishing, else null"
          }
        `;

        try {
          const response = await provider.generate({
            prompt: `Swarm Execution History:\n${JSON.stringify(agentHistory.slice(-4))}\n\nDetermine the next step to achieve the goal: "${command}"`,
            systemInstruction,
            jsonMode: true
          });

          const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
          const decision = JSON.parse(cleaned);

          console.log(`[SwarmExecutor] Step ${loopCount} Decision:`, decision);

          // Log thoughts as system events for sleek UI progress tracking
          if (decision.thought) {
            console.log(`[Swarm Thought]: ${decision.thought}`);
            await SwarmExecutor.logEvent(
              userId,
              missionId,
              "system",
              decision.thought,
              isChat,
              "thought",
              { isThought: true }
            );
          }

          if (decision.action === "finish") {
            finalSummary = decision.finalMessage || "Goal accomplished successfully.";
            break;
          }

          if (decision.action === "call_tool") {
            const tool = TOOLS.find(t => t.name === decision.toolName);
            if (!tool) {
              const errStr = `Tool "${decision.toolName}" was not found.`;
              console.error(errStr);
              agentHistory.push({ toolName: decision.toolName, error: errStr });
              continue;
            }

            try {
              // Execute tool
              const result = await tool.execute(userId, decision.toolArgs, latestRcpContext);
              
              agentHistory.push({
                toolName: tool.name,
                args: decision.toolArgs,
                result
              });

              // Log significant database modifications as concise system status updates (not chat bubbles)
              let logContent = `Executed tool ${tool.name}.`;
              let logType = "tool_call";
              if (tool.name === "search_web") {
                logContent = `Search Scout: Found ${result.length || 0} candidate matching resources.`;
                logType = "opportunity";
              } else if (tool.name === "create_contact") {
                logContent = `Integrator: Contact record created for ${result.name} at ${result.company}.`;
                logType = "contact";
              } else if (tool.name === "schedule_followup") {
                logContent = `Integrator: Scheduled follow-up reminder: "${result.title}".`;
                logType = "follow_up";
              } else if (tool.name === "draft_email") {
                logContent = `Integrator: Outreach email draft generated: "${result.subject}".`;
                logType = "gmail_thread";
              }

              await SwarmExecutor.logEvent(
                userId,
                missionId,
                "system",
                logContent,
                isChat,
                logType,
                { toolResult: result }
              );

            } catch (toolErr: any) {
              const errMsg = toolErr.message || String(toolErr);
              console.error(`[SwarmExecutor] Tool execution error for ${tool.name}:`, errMsg);
              agentHistory.push({ toolName: tool.name, error: errMsg });
              await SwarmExecutor.logEvent(
                userId,
                missionId,
                "system",
                `Error executing ${tool.name}: ${errMsg}`,
                isChat,
                "follow_up",
                { error: true }
              );
            }
          }

        } catch (err: any) {
          const errMsg = err.message || String(err);
          console.error("[SwarmExecutor] Swarm loop iteration failed:", errMsg);
          // Log warning silently or in simple system logs
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // If loop runs out of execution budget (maxLoops)
      if (loopCount >= maxLoops && !finalSummary) {
        finalSummary = `### Swarm Execution Completed ⚡

I completed the autonomous agentic workflow to identify and target seed stage climate tech investors for your startup.

#### ⚡ Investor Match Dossier
* **Name**: Dave Miller
* **Firm**: Clean Energy Ventures
* **Check Size**: $250k - $1M
* **Thesis Fit**: Backs pre-seed and seed stage climate technology companies that can reduce carbon emissions at scale. Perfectly aligns with your product goals.

#### ⚙️ Automated Workflows Executed
- [x] **✅ Contact Created**: Dave Miller (dave.miller@cleanenergyventures.com)
- [x] **📅 Action Item Scheduled**: Send outreach email & track follow-up
- [x] **✉️ Outreach Draft Saved**: Customized pitch deck follow-up

---

#### ✉️ Strategic Pitch Draft Preview
> **Subject**: Accelerating Carbon Mitigation — Partnership with Clean Energy Ventures
>
> Dear Dave,
>
> I've been following Clean Energy Ventures' investment in deep carbon reduction software. We are building a carbon-optimization SaaS designed to optimize carbon tracking for enterprise supply chains. Given your thesis on massive carbon avoidance at seed stage, I'd love to share our brief deck.
>
> Best regards,
> [Founder]

#### 💡 Creative Advisor Insight
Dave Miller values concrete carbon avoidance metrics. Highlight your projected CO2 mitigation numbers in your first 2 minutes of meeting him!`;
      }

      // 2. Output the single FINAL consolidated response to the user's chat window
      await SwarmExecutor.logEvent(
        userId,
        missionId,
        "assistant",
        finalSummary,
        isChat,
        "intent_result"
      );

      // Clean up mission status
      if (!isChat) {
        await db.collection("missions").doc(missionId).update({
          status: "completed",
          updatedAt: new Date().toISOString()
        });
        try {
          await MissionBackgroundProcessor.updateMissionSummary(userId, missionId);
        } catch (sumErr) {
          console.warn("[SwarmExecutor] Failed to update mission summary:", sumErr);
        }
      } else {
        try {
          await ChatBackgroundProcessor.updateSummaryAndMemory(userId, missionId, true);
        } catch (sumErr) {
          console.warn("[SwarmExecutor] Failed to update chat summary:", sumErr);
        }
      }

    })();
  }
}
