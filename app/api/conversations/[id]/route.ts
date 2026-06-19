import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id: conversationId } = await params;

    // 1. Fetch conversation metadata
    const convRef = db.collection("conversations").doc(conversationId);
    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    const conversationData = convDoc.data();
    if (conversationData?.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 2. Fetch messages subcollection
    const messagesSnap = await convRef.collection("messages").get();
    const messages = messagesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Deterministic sort by sequenceNumber ascending
    messages.sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    // 3. Fetch conversation memory
    const memoryDoc = await db.collection("conversation_memory").doc(conversationId).get();
    const memory = memoryDoc.exists ? memoryDoc.data() : {};

    return NextResponse.json({
      success: true,
      conversation: { id: conversationId, ...conversationData },
      messages,
      memory,
    });
  } catch (error: any) {
    console.error("GET /api/conversations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch conversation details" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}
