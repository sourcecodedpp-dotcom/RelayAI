import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { buildRCP } from "@/lib/rcp/compiler";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 1. Protection: Development environment only
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Forbidden", message: "Debug endpoints are only available in development environment." },
        { status: 403 }
      );
    }

    // 2. Protection: Authenticated owner access only
    const userId = await getAuthenticatedUserOrThrow();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Bad Request", message: "conversationId query parameter is required." },
        { status: 400 }
      );
    }

    // Verify conversation ownership
    const convDoc = await db.collection("conversations").doc(conversationId).get();
    if (!convDoc.exists) {
      return NextResponse.json(
        { error: "Not Found", message: "Conversation not found." },
        { status: 404 }
      );
    }
    const conversationData = convDoc.data() || {};
    if (conversationData.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Access denied." },
        { status: 401 }
      );
    }

    // Build the RCP and measure performance
    const startBuildTime = Date.now();
    const compiledRcp = await buildRCP(userId, conversationId);
    const generationTimeMs = Date.now() - startBuildTime;

    const { getCacheHitStatus } = await import("@/lib/rcp/compiler");
    const cacheHit = getCacheHitStatus(userId, conversationId);

    // Identify included sections
    const includedSections: string[] = [];
    if (compiledRcp.includes("CONVERSATION")) includedSections.push("CONVERSATION");
    if (compiledRcp.includes("PROFILE")) includedSections.push("PROFILE");
    if (compiledRcp.includes("GMAIL")) includedSections.push("GMAIL");
    if (compiledRcp.includes("FOLLOWUPS")) includedSections.push("FOLLOWUPS");
    if (compiledRcp.includes("OPPORTUNITIES")) includedSections.push("OPPORTUNITIES");
    if (compiledRcp.includes("CONTACTS")) includedSections.push("CONTACTS");

    const tokenCount = Math.ceil(compiledRcp.length / 4);

    return NextResponse.json({
      compiledRcp,
      tokenCount,
      cacheHit,
      generationTimeMs,
      includedSections,
    });
  } catch (error: any) {
    console.error("GET /api/debug/rcp error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message || "Failed to fetch rcp debug data" },
      { status: 500 }
    );
  }
}
