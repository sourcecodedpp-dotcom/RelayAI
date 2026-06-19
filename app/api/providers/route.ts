import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";
import {
  SYSTEM_MODELS,
  GEMINI_MODELS,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
} from "@/lib/ai/providers/provider-router";
import { decryptToken } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

// Server-side in-memory cache for OpenRouter models
let cachedOpenRouterModels: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchOpenRouterModels(apiKey?: string): Promise<any[]> {
  const now = Date.now();
  if (cachedOpenRouterModels && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log("[OpenRouter Cache] Returning cached models list");
    return cachedOpenRouterModels;
  }

  try {
    console.log("[OpenRouter Cache] Fetching fresh models list");
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers,
    });

    if (!res.ok) {
      throw new Error(`OpenRouter returned status ${res.status}`);
    }

    const json = await res.json();
    const list = (json.data || []).map((m: any) => ({
      model: m.id,
      name: m.name || m.id,
      maxContextTokens: m.context_length || 128000,
      supportsTools: true,
      supportsStreaming: true,
    }));

    if (list.length > 0) {
      cachedOpenRouterModels = list;
      cacheTimestamp = now;
      return list;
    }
  } catch (err) {
    console.error("Failed to fetch OpenRouter models:", err);
  }

  // Graceful fallback if call fails and no cache exists
  return cachedOpenRouterModels || [
    { model: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct", maxContextTokens: 128000, supportsTools: true, supportsStreaming: true },
    { model: "google/gemini-flash-1.5", name: "Gemini Flash 1.5", maxContextTokens: 1000000, supportsTools: true, supportsStreaming: true },
  ];
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    // 1. Fetch connection statuses from Firestore
    const apiKeysSnap = await db.collection("users").doc(userId).collection("api_keys").get();
    const connections: Record<string, { connected: boolean; lastVerifiedAt: string | null }> = {
      gemini: { connected: false, lastVerifiedAt: null },
      openai: { connected: false, lastVerifiedAt: null },
      anthropic: { connected: false, lastVerifiedAt: null },
      openrouter: { connected: false, lastVerifiedAt: null },
    };

    let openRouterKey: string | undefined = undefined;

    apiKeysSnap.forEach((doc) => {
      const providerName = doc.id;
      const data = doc.data();
      if (connections[providerName]) {
        connections[providerName] = {
          connected: true,
          lastVerifiedAt: data.lastVerifiedAt || null,
        };
      }

      if (providerName === "openrouter" && data.encryptedApiKey) {
        try {
          openRouterKey = decryptToken(data.encryptedApiKey, data.keyVersion || "1");
        } catch (e) {
          console.error("Failed to decrypt OpenRouter key for models fetch:", e);
        }
      }
    });

    // 2. Fetch user's default provider settings
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const defaultProvider = userData.defaultProvider || "system";
    const defaultModel = userData.defaultModel || "mercury-2";

    // 3. Fetch OpenRouter models
    const openRouterModels = await fetchOpenRouterModels(openRouterKey);

    return NextResponse.json({
      connections,
      defaultProvider,
      defaultModel,
      models: {
        system: SYSTEM_MODELS,
        gemini: GEMINI_MODELS,
        openai: OPENAI_MODELS,
        anthropic: ANTHROPIC_MODELS,
        openrouter: openRouterModels,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
