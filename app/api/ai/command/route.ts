import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { CommandRouter } from "@/lib/ai/orchestration/command-router";
import { db } from "@/lib/db/firestore";
import { z } from "zod";
import { MissionBackgroundProcessor } from "@/lib/ai/orchestration/mission-background";
import { sanitizeFirestore } from "@/lib/utils/sanitize-firestore";
import { decryptToken } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

// Zod validation schemas
const CommandRequestSchema = z.object({
  command: z.string().min(1, { message: "Command prompt cannot be empty" }),
  missionId: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
});

const ActionSchema = z.object({
  type: z.enum(["redirect", "display"]),
  url: z.string().optional(),
});

const CommandResponseSchema = z.object({
  success: z.boolean(),
  type: z.literal("command_result"),
  title: z.string(),
  summary: z.string(),
  actions: z.array(ActionSchema),
  missionId: z.string().optional().nullable(),
  data: z.object({
    intent: z.string(),
    contactName: z.string().nullable().optional(),
    message: z.string(),
    missionId: z.string().optional().nullable(),
  }),
});

export async function POST(req: Request) {
  let userId: string | null = null;
  let commandStr = "unknown";

  try {
    userId = await getAuthenticatedUserOrThrow();
    
    const body = await req.json();
    console.log("[STAGE: Request received] Payload:", body);

    // Validate request schema
    const requestValidation = CommandRequestSchema.safeParse(body);
    if (!requestValidation.success) {
      const errorMsg = `Invalid request payload: ${requestValidation.error.errors.map((e) => e.message).join(", ")}`;
      console.error("[STAGE: Error occurred] Request validation failed:", errorMsg);
      return NextResponse.json({
        success: false,
        error: errorMsg
      }, { status: 400 });
    }

    const { command, missionId, provider: reqProvider, model: reqModel } = requestValidation.data;
    commandStr = command;

    let targetMissionId = missionId;
    let isNewMission = false;
    const now = new Date().toISOString();

    // Fetch user's default settings
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const userDefaultProvider = userData.defaultProvider || "system";
    const userDefaultModel = userData.defaultModel || "mercury-2";

    let activeProvider = "";
    let activeModel = "";

    if (!targetMissionId) {
      // 1. Determine if we are on briefing and need to create a new mission
      isNewMission = true;
      const newMissionRef = db.collection("missions").doc();
      targetMissionId = newMissionRef.id;

      activeProvider = reqProvider || userDefaultProvider;
      activeModel = reqModel || userDefaultModel;

      const missionData = sanitizeFirestore({
        userId,
        title: "Untitled Mission",
        summary: "",
        currentSummary: "",
        provider: activeProvider,
        model: activeModel,
        status: "active",
        eventCount: 0,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      });

      try {
        await newMissionRef.set(missionData);
      } catch (error) {
        console.error("Firestore write failed", {
          collection: "missions",
          documentId: targetMissionId,
          payload: missionData,
          error: error instanceof Error ? error.message : error,
        });
        throw error;
      }

      console.log(`[POST /api/ai/command] Initialized new mission: ${targetMissionId}`);
    } else {
      // Fetch existing mission config
      const missionDoc = await db.collection("missions").doc(targetMissionId).get();
      if (!missionDoc.exists) {
        return NextResponse.json({ success: false, error: "Mission not found" }, { status: 404 });
      }
      const existingMission = missionDoc.data() || {};

      activeProvider = existingMission.provider || "system";
      activeModel = existingMission.model || "mercury-2";

      // If switched mid-mission
      if (reqProvider && reqModel && (reqProvider !== activeProvider || reqModel !== activeModel)) {
        activeProvider = reqProvider;
        activeModel = reqModel;
        
        await db.collection("missions").doc(targetMissionId).update({
          provider: activeProvider,
          model: activeModel,
          updatedAt: now,
        });

        // Log provider change event to mission events
        await MissionBackgroundProcessor.logEvent(
          userId,
          targetMissionId,
          "system",
          `Switched model to ${activeModel} (${activeProvider})`,
          {
            type: "provider_change",
            provider: activeProvider,
            model: activeModel
          }
        );
      }

      // Update lastActivityAt for the existing mission
      const missionUpdate = sanitizeFirestore({
        lastActivityAt: now,
        updatedAt: now,
      });

      try {
        await db.collection("missions").doc(targetMissionId).update(missionUpdate);
      } catch (error) {
        console.error("Firestore write failed", {
          collection: "missions",
          documentId: targetMissionId,
          payload: missionUpdate,
          error: error instanceof Error ? error.message : error,
        });
        throw error;
      }
    }

    // 2. Log the command event to mission_events
    await MissionBackgroundProcessor.logEvent(
      userId,
      targetMissionId,
      "command",
      command,
      {}
    );

    // 3. Look up credentials and Decrypt API key
    let apiKey = "";
    if (activeProvider === "system" || activeProvider === "mercury") {
      apiKey = process.env.MERCURY_API_KEY || "";
    } else {
      const keyRef = db.collection("users").doc(userId).collection("api_keys").doc(activeProvider);
      const keyDoc = await keyRef.get();
      if (!keyDoc.exists) {
        return NextResponse.json({
          success: false,
          providerError: true,
          fallbackAvailable: true,
          message: `Your API key for ${activeProvider} is not connected. Switch to Relay Cloud?`
        }, { status: 400 });
      }

      const keyData = keyDoc.data() || {};
      if (!keyData.encryptedApiKey) {
        return NextResponse.json({
          success: false,
          providerError: true,
          fallbackAvailable: true,
          message: `Your API key for ${activeProvider} is missing. Switch to Relay Cloud?`
        }, { status: 400 });
      }

      try {
        apiKey = decryptToken(keyData.encryptedApiKey, keyData.keyVersion || "1");
      } catch (decErr) {
        console.error("API Key decryption failed:", decErr);
        return NextResponse.json({
          success: false,
          providerError: true,
          fallbackAvailable: true,
          message: `Failed to decrypt your ${activeProvider} API key. Switch to Relay Cloud?`
        }, { status: 400 });
      }
    }

    // 4. Compile the RCP context block and invoke the Autonomous Swarm Executor in the background
    const startTime = Date.now();
    let rcpContext = "";
    try {
      const { buildRCP } = await import("@/lib/rcp/compiler");
      rcpContext = await buildRCP(userId, targetMissionId);
    } catch (rcpErr) {
      console.warn("Failed to compile RCP context: ", rcpErr);
    }

    // Trigger SwarmExecutor asynchronously (non-blocking)
    try {
      const { SwarmExecutor } = await import("@/lib/ai/agents/swarm-executor");
      SwarmExecutor.execute(
        userId,
        targetMissionId,
        command,
        rcpContext,
        activeProvider,
        activeModel,
        apiKey
      );
    } catch (swarmErr) {
      console.error("Failed to execute SwarmExecutor in background: ", swarmErr);
    }

    const latencyMs = Date.now() - startTime;
    const aiMessage = "Autonomous Swarm Activated: Starting background scanning and DB updates...";

    // 5. Save the AI output event to mission_events
    await MissionBackgroundProcessor.logEvent(
      userId,
      targetMissionId,
      "ai_output",
      aiMessage,
      {
        intent: "autonomous_agent",
        actions: [
          {
            type: "redirect",
            url: `/mission/${targetMissionId}`
          }
        ],
        title: "Autonomous Swarm Initialized"
      }
    );

    // 6. Trigger background asynchronous updates
    if (isNewMission) {
      MissionBackgroundProcessor.generateTitleAndSummary(
        userId,
        targetMissionId,
        command,
        aiMessage
      );
    } else {
      MissionBackgroundProcessor.updateMissionSummary(userId, targetMissionId);
    }

    // 7. Log usage metrics to usage_logs
    try {
      const promptTokens = Math.ceil((command.length + 500) / 4);
      const completionTokens = Math.ceil(aiMessage.length / 4);
      const totalTokens = promptTokens + completionTokens;

      await db.collection("usage_logs").add(sanitizeFirestore({
        userId,
        conversationId: targetMissionId,
        provider: activeProvider,
        model: activeModel,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        createdAt: new Date().toISOString(),
      }));
    } catch (logErr) {
      console.warn("Failed to write usage log:", logErr);
    }

    // 8. Redirect user to the new or active workspace page immediately
    const finalResult = {
      success: true,
      type: "command_result",
      title: "Autonomous Mission Initialized",
      summary: "Starting background search and database pipeline...",
      actions: [
        {
          type: "redirect",
          url: `/mission/${targetMissionId}`,
        }
      ],
      missionId: targetMissionId,
      data: {
        intent: "autonomous_agent",
        message: "Background agents processing your command...",
        missionId: targetMissionId,
      }
    };

    // Validate response schema
    const responseValidation = CommandResponseSchema.safeParse(finalResult);
    if (!responseValidation.success) {
      console.warn("Zod response validation warning:", responseValidation.error.format());
    }

    // Write audit log to Firestore
    const auditData = sanitizeFirestore({
      userId,
      action: isNewMission ? "ai_command_new_mission" : "ai_command_existing_mission",
      details: JSON.stringify({ command, routeResult: finalResult, missionId: targetMissionId }),
      userAgent: req.headers.get("user-agent") || "Web Browser",
      createdAt: new Date(),
    });

    try {
      const auditLogRef = await db.collection("audit_logs").add(auditData);
      console.log(`[STAGE: Firestore update completed] Audit log record ID: ${auditLogRef.id}`);
    } catch (error) {
      console.error("Firestore write failed", {
        collection: "audit_logs",
        payload: auditData,
        error: error instanceof Error ? error.message : error,
      });
    }

    console.log("[STAGE: Response sent] Status: Success");
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("[STAGE: Error occurred] Details:", error.message || error);
    
    let errorMessage = "An unexpected error occurred.";
    if (error.message && error.message.includes("MERCURY_API_KEY")) {
      errorMessage = "Missing API key: MERCURY_API_KEY is not configured.";
    } else if (error.message && (error.message.includes("401") || error.message.includes("Authentication"))) {
      errorMessage = "Authentication failure: Invalid Mercury API key.";
    } else if (error instanceof SyntaxError || (error.message && error.message.includes("JSON"))) {
      errorMessage = "Invalid JSON: Failed to parse AI response.";
    } else if (error.message && error.message.includes("timed out")) {
      errorMessage = "AI request timed out";
    } else if (error.message && (error.message.includes("429") || error.message.includes("Rate limit"))) {
      errorMessage = "Rate limit exceeded. Please try again later.";
    } else if (error.message && error.message.includes("empty completions")) {
      errorMessage = "Empty response received from AI model.";
    } else if (error.message && (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("ENOTFOUND"))) {
      errorMessage = "Network error: Failed to reach Inception Labs API.";
    } else {
      errorMessage = error.message || String(error);
    }

    // Write error log to Firestore
    if (userId) {
      try {
        await db.collection("audit_logs").add({
          userId,
          action: "ai_command_error",
          details: JSON.stringify({ command: commandStr, error: errorMessage }),
          userAgent: req.headers.get("user-agent") || "Web Browser",
          createdAt: new Date(),
        });
      } catch (logErr) {
        console.warn("Failed to write error audit log to Firestore:", logErr);
      }
    }

    console.log("[STAGE: Response sent] Status: Error");
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 200 });
  }
}
