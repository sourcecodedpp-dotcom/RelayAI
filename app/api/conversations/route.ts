import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    const snapshot = await db
      .collection("conversations")
      .where("userId", "==", userId)
      .get();

    const conversations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by lastMessageAt descending (latest first)
    conversations.sort((a: any, b: any) => {
      const timeA = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch conversations" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}
