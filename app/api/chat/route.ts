import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { CommandRouter } from "@/lib/ai/orchestration/command-router";
import { ChatBackgroundProcessor } from "@/lib/ai/orchestration/chat-background";
import { sanitizeFirestore } from "@/lib/utils/sanitize-firestore";
import { decryptToken } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const { message, conversationId, provider: reqProvider, model: reqModel } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    let activeConversationId = conversationId;
    let isNewConversation = false;
    const now = new Date().toISOString();

    // Fetch user's default settings
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const userDefaultProvider = userData.defaultProvider || "system";
    const userDefaultModel = userData.defaultModel || "mercury-2";

    let activeProvider = "";
    let activeModel = "";

    // 1. Resolve or create conversation
    if (!activeConversationId) {
      isNewConversation = true;
      const convRef = db.collection("conversations").doc();
      activeConversationId = convRef.id;

      activeProvider = reqProvider || userDefaultProvider;
      activeModel = reqModel || userDefaultModel;

      const convData = sanitizeFirestore({
        userId,
        title: "Untitled Conversation",
        summary: "",
        provider: activeProvider,
        model: activeModel,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        status: "active",
      });
      try {
        await convRef.set(convData);
      } catch (error) {
        console.error("Firestore write failed", {
          collection: "conversations",
          documentId: activeConversationId,
          payload: convData,
          error: error instanceof Error ? error.message : error,
        });
        throw error;
      }

      // Initialize conversation memory document
      const memRef = db.collection("conversation_memory").doc(activeConversationId);
      const memData = sanitizeFirestore({
        conversationId: activeConversationId,
        userId,
        summary: "",
        entities: [],
        goals: [],
        contacts: [],
        companies: [],
        updatedAt: now,
      });
      try {
        await memRef.set(memData);
      } catch (error) {
        console.error("Firestore write failed", {
          collection: "conversation_memory",
          documentId: activeConversationId,
          payload: memData,
          error: error instanceof Error ? error.message : error,
        });
        throw error;
      }

      console.log(`[POST /api/chat] Created new conversation: ${activeConversationId}`);
    } else {
      // Verify conversation ownership
      const convDoc = await db.collection("conversations").doc(activeConversationId).get();
      if (!convDoc.exists) {
        return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
      }
      const existingConv = convDoc.data() || {};
      if (existingConv.userId !== userId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
      }

      activeProvider = existingConv.provider || "system";
      activeModel = existingConv.model || "mercury-2";

      // Check if user requested a model switch mid-conversation
      if (reqProvider && reqModel && (reqProvider !== activeProvider || reqModel !== activeModel)) {
        activeProvider = reqProvider;
        activeModel = reqModel;

        const convRef = db.collection("conversations").doc(activeConversationId);
        await convRef.update({
          provider: activeProvider,
          model: activeModel,
          updatedAt: now,
        });

        // Insert provider change system event message
        const currentMessagesSnap = await convRef.collection("messages").get();
        const eventSeqNum = currentMessagesSnap.size + 1;
        const eventMsgRef = convRef.collection("messages").doc();
        const eventData = sanitizeFirestore({
          conversationId: activeConversationId,
          userId,
          role: "system",
          content: `Switched model to ${activeModel} (${activeProvider})`,
          metadata: {
            type: "provider_change",
            provider: activeProvider,
            model: activeModel,
          },
          sequenceNumber: eventSeqNum,
          createdAt: new Date().toISOString(),
        });
        await eventMsgRef.set(eventData);
        console.log(`[POST /api/chat] Saved provider change event to conversation ${activeConversationId}`);
      }
    }

    const convRef = db.collection("conversations").doc(activeConversationId);

    // Get current message count to determine next sequence number
    const currentMessagesSnap = await convRef.collection("messages").get();
    const userSequenceNumber = currentMessagesSnap.size + 1;
    const assistantSequenceNumber = userSequenceNumber + 1;

    // 2. Persist user message to Firestore subcollection BEFORE running AI
    const userMsgRef = convRef.collection("messages").doc();
    const userMsgData = sanitizeFirestore({
      conversationId: activeConversationId,
      userId,
      role: "user",
      content: message.trim(),
      sequenceNumber: userSequenceNumber,
      createdAt: new Date().toISOString(),
    });
    try {
      await userMsgRef.set(userMsgData);
    } catch (error) {
      console.error("Firestore write failed", {
        collection: "messages",
        documentId: userMsgRef.id,
        payload: userMsgData,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }

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

    // 4. Execute AI response generation with conversation context and parameterized providers
    let routeResult;
    const startTime = Date.now();
    try {
      routeResult = await CommandRouter.route(userId, message.trim(), activeConversationId, activeProvider, activeModel, apiKey);
    } catch (routeErr: any) {
      console.error(`CommandRouter execution failed for provider ${activeProvider}:`, routeErr);
      return NextResponse.json({
        success: false,
        providerError: true,
        fallbackAvailable: true,
        message: `Your ${activeProvider} API key or connection is invalid. Switch to Relay Cloud?`
      }, { status: 400 });
    }
    const latencyMs = Date.now() - startTime;

    const aiMessage = routeResult.summary || routeResult.message || routeResult.data?.message || "Command executed successfully.";

    // 5. Persist AI response message to Firestore subcollection BEFORE rendering
    const aiMsgRef = convRef.collection("messages").doc();
    const aiData = sanitizeFirestore({
      conversationId: activeConversationId,
      userId,
      role: "assistant",
      content: aiMessage,
      metadata: {
        intent: routeResult.intent || routeResult.data?.intent || "conversational_chat",
        actions: routeResult.actions || [],
        title: routeResult.title || "AI Response",
      },
      sequenceNumber: assistantSequenceNumber,
      createdAt: new Date().toISOString(),
    });
    try {
      await aiMsgRef.set(aiData);
    } catch (error) {
      console.error("Firestore write failed", {
        collection: "messages",
        documentId: aiMsgRef.id,
        payload: aiData,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }

    // 6. Update lastMessageAt on conversation document
    const finalUpdateTimestamp = new Date().toISOString();
    const updateData = sanitizeFirestore({
      lastMessageAt: finalUpdateTimestamp,
      updatedAt: finalUpdateTimestamp,
    });
    try {
      await convRef.update(updateData);
    } catch (error) {
      console.error("Firestore write failed", {
        collection: "conversations",
        documentId: activeConversationId,
        payload: updateData,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }

    // 7. Log usage metrics to usage_logs
    try {
      const promptTokens = Math.ceil((message.length + 500) / 4);
      const completionTokens = Math.ceil(aiMessage.length / 4);
      const totalTokens = promptTokens + completionTokens;

      await db.collection("usage_logs").add(sanitizeFirestore({
        userId,
        conversationId: activeConversationId,
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

    // 8. Trigger background asynchronous title & memory/summary generation
    if (isNewConversation) {
      ChatBackgroundProcessor.generateTitle(activeConversationId, message.trim(), aiMessage);
    }
    ChatBackgroundProcessor.updateSummaryAndMemory(userId, activeConversationId);

    // 9. Construct and return response payload
    const responsePayload = {
      conversationId: activeConversationId,
      response: routeResult,
    };

    console.log(`[POST /api/chat] Successfully processed message in conversation ${activeConversationId}`);
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process chat" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}
