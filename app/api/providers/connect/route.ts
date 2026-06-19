import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { encryptToken } from "@/lib/security/crypto";
import { getProvider } from "@/lib/ai/providers/provider-router";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { provider, apiKey } = await req.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ success: false, error: "Provider and API Key are required." }, { status: 400 });
    }

    const normalizedProvider = provider.toLowerCase();
    const validProviders = ["gemini", "openai", "anthropic", "openrouter"];
    if (!validProviders.includes(normalizedProvider)) {
      return NextResponse.json({ success: false, error: "Invalid provider." }, { status: 400 });
    }

    // 1. Perform connection test
    let testModel = "";
    if (normalizedProvider === "gemini") testModel = "gemini-2.5-flash";
    else if (normalizedProvider === "openai") testModel = "gpt-4o-mini";
    else if (normalizedProvider === "anthropic") testModel = "claude-3-5-haiku-latest";
    else if (normalizedProvider === "openrouter") testModel = "meta-llama/llama-3.1-8b-instruct:free";

    try {
      const providerInst = getProvider(normalizedProvider, apiKey, testModel);
      await providerInst.generate({
        prompt: "ping",
        temperature: 0.1,
      });
    } catch (testErr: any) {
      console.error(`Connection test failed for ${provider}:`, testErr);
      return NextResponse.json({
        success: false,
        error: `Connection test failed: ${testErr.message || "Invalid API key"}`
      }, { status: 400 });
    }

    // 2. Encrypt token
    const { ciphertext, version } = encryptToken(apiKey);

    // 3. Save to Firestore under users/{userId}/api_keys/{provider}
    const docRef = db.collection("users").doc(userId).collection("api_keys").doc(normalizedProvider);
    const docSnap = await docRef.get();
    
    const now = new Date().toISOString();
    const data: any = {
      encryptedApiKey: ciphertext,
      keyVersion: version,
      lastVerifiedAt: now,
      updatedAt: now,
    };

    if (!docSnap.exists) {
      data.createdAt = now;
      await docRef.set(data);
    } else {
      await docRef.update(data);
    }

    return NextResponse.json({ success: true, message: `${provider} connected successfully.` });
  } catch (error) {
    return handleApiError(error);
  }
}
