import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";

export const dynamic = "force-dynamic";
import { PrioritizationAgent } from "@/lib/ai/agents/prioritization-agent";
import { handleApiError } from "@/lib/security/errors";
import { OpportunityStatus } from "@/types";

/**
 * GET /api/opportunities - Retrieve pending opportunities prioritized by score.
 * Triggers score recalculations dynamically based on elapsed time before returning results.
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    // 1. Run dynamic scoring recalculation (prioritization factors)
    await PrioritizationAgent.recalculateScores(userId);

    // 2. Fetch pending opportunities directly from Firestore
    const snapshot = await db.collection("opportunities")
      .where("userId", "==", userId)
      .where("status", "==", OpportunityStatus.PENDING)
      .get();

    const opportunities: any[] = [];

    for (const doc of snapshot.docs) {
      const opp = { id: doc.id, ...doc.data() } as any;

      // Resolve associated Contact details
      if (opp.contactId) {
        const contactDoc = await db.collection("contacts").doc(opp.contactId).get();
        if (contactDoc.exists) {
          const contact = { id: contactDoc.id, ...contactDoc.data() } as any;
          
          // Resolve associated research doc
          const researchDoc = await db.collection("research").doc(opp.contactId).get();
          contact.research = researchDoc.exists ? { id: researchDoc.id, ...researchDoc.data() } : null;
          
          opp.contact = contact;
        } else {
          opp.contact = null;
        }
      } else {
        opp.contact = null;
      }

      // Resolve outreach thread
      if (opp.outreachThreadId) {
        const threadDoc = await db.collection("outreach_threads").doc(opp.outreachThreadId).get();
        opp.outreachThread = threadDoc.exists ? { id: threadDoc.id, ...threadDoc.data() } : null;
      } else {
        opp.outreachThread = null;
      }

      // Resolve follow up
      if (opp.followUpId) {
        const followupDoc = await db.collection("follow_ups").doc(opp.followUpId).get();
        opp.followUp = followupDoc.exists ? { id: followupDoc.id, ...followupDoc.data() } : null;
      } else {
        opp.followUp = null;
      }

      opportunities.push(opp);
    }

    // Sort opportunities by priorityScore descending in memory to avoid missing index errors
    opportunities.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

    return NextResponse.json(opportunities);
  } catch (error) {
    return handleApiError(error);
  }
}
