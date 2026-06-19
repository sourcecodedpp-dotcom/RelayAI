import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { provider } = await req.json();

    if (!provider) {
      return NextResponse.json({ success: false, error: "Provider is required." }, { status: 400 });
    }

    const normalizedProvider = provider.toLowerCase();
    const validProviders = ["gemini", "openai", "anthropic", "openrouter"];
    if (!validProviders.includes(normalizedProvider)) {
      return NextResponse.json({ success: false, error: "Invalid provider." }, { status: 400 });
    }

    const docRef = db.collection("users").doc(userId).collection("api_keys").doc(normalizedProvider);
    await docRef.delete();

    // Reset default user setting if they disconnected their current default provider
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      if (userData?.defaultProvider === normalizedProvider) {
        await userRef.update({
          defaultProvider: "system",
          defaultModel: "mercury-2"
        });
      }
    }

    return NextResponse.json({ success: true, message: `${provider} disconnected successfully.` });
  } catch (error) {
    return handleApiError(error);
  }
}
