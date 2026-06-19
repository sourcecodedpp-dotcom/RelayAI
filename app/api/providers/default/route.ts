import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { provider, model } = await req.json();

    if (!provider || !model) {
      return NextResponse.json({ success: false, error: "Provider and Model are required." }, { status: 400 });
    }

    const normalizedProvider = provider.toLowerCase();
    const validProviders = ["system", "gemini", "openai", "anthropic", "openrouter"];
    if (!validProviders.includes(normalizedProvider)) {
      return NextResponse.json({ success: false, error: "Invalid provider." }, { status: 400 });
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    const updateData = {
      defaultProvider: normalizedProvider,
      defaultModel: model,
      updatedAt: new Date().toISOString(),
    };

    if (!userSnap.exists) {
      await userRef.set({
        id: userId,
        ...updateData,
        createdAt: new Date().toISOString(),
      });
    } else {
      await userRef.update(updateData);
    }

    return NextResponse.json({ success: true, message: "Default AI settings updated successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
