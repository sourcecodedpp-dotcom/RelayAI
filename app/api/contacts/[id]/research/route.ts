import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError, ApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";
import { ResearchAgent } from "@/lib/ai/agents/research-agent";
import { ContextEngine } from "@/lib/ai/orchestration/context-engine";
import { OpportunityEngine } from "@/lib/ai/orchestration/opportunity-engine";
import { AuditAction } from "@/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/contacts/[id]/research - Trigger AI-powered research for a specific contact
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id: contactId } = await context.params;

    // 1. Fetch contact and verify tenant ownership
    const contactDoc = await db.collection("contacts").doc(contactId).get();

    if (!contactDoc.exists) {
      throw new ApiError("Contact not found.", 404);
    }

    const contact = contactDoc.data() as any;

    if (contact.userId !== userId) {
      throw new ApiError("Access denied: You do not own this contact.", 403);
    }

    // 2. Assemble context
    const contactContext = await ContextEngine.assembleContactContext(userId, contactId);

    // 3. Call AI agent to conduct research
    const researchResult = await ResearchAgent.run(userId, {
      contactName: contact.name,
      company: contact.company,
      role: contact.role,
      notes: contact.notes ?? undefined,
      userGoals: contactContext.userGoals,
    });

    // 4. Save JSON results to the Research collection (linked to contact)
    const now = new Date().toISOString();
    const researchRef = db.collection("research").doc(contactId);

    const researchData = {
      userId,
      contactId,
      data: researchResult,
      createdAt: now,
      updatedAt: now,
    };

    await researchRef.set(researchData);

    // 5. Trigger a discovery opportunity if the contact is still in "DISCOVERED" status
    if (contact.relationshipStatus === "DISCOVERED") {
      await OpportunityEngine.triggerNewContactOpportunity(
        userId,
        contactId,
        contact.name,
        contact.company,
        contact.role
      );
    }

    // 6. Write to audit trail
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: AuditAction.FOLLOW_UP_ACTION,
      details: JSON.stringify({ contactId, action: "research_triggered" }),
      userAgent,
      createdAt: now,
    });

    return NextResponse.json({ id: contactId, ...researchData });
  } catch (error) {
    return handleApiError(error);
  }
}
