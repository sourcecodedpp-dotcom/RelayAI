import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me - Retrieve user profile and integration statuses
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found", message: "No database record matches this session." },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const googleConnectionDoc = await db.collection("google_connections").doc(userId).get();
    const googleConnection = googleConnectionDoc.exists 
      ? { email: googleConnectionDoc.data()?.email } 
      : null;

    return NextResponse.json({
      id: userId,
      ...userData,
      googleConnection,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
