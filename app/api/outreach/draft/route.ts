import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError, ApiError } from "@/lib/security/errors";
import { MissionBackgroundProcessor } from "@/lib/ai/orchestration/mission-background";
import { publishRCPEvent } from "@/lib/rcp/processor";

export const dynamic = "force-dynamic";
import { OutreachAgent } from "@/lib/ai/agents/outreach-agent";
import { createGmailDraft } from "@/lib/gmail/client";
import { AuditAction, RelationshipStatus } from "@/types";
import { z } from "zod";

const draftRequestSchema = z.object({
  contactId: z.string().min(1, "Invalid contact ID."),
  goalId: z.string().min(1, "Invalid goal ID."),
  additionalPrompt: z.string().optional(),
  missionId: z.string().optional().nullable(),
});

/**
 * POST /api/outreach/draft - Generate a personalized AI outreach email and sync to Gmail drafts
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = draftRequestSchema.parse(body);

    const now = new Date().toISOString();

    // 1. Load contact and verify owner
    const contactDoc = await db.collection("contacts").doc(validated.contactId).get();
    if (!contactDoc.exists) {
      throw new ApiError("Contact not found.", 404);
    }
    const contact = contactDoc.data() as any;
    if (contact.userId !== userId) {
      throw new ApiError("Access denied: You do not own this contact.", 403);
    }

    // Load contact research doc
    const researchDoc = await db.collection("research").doc(validated.contactId).get();
    const research = researchDoc.exists ? (researchDoc.data() as any) : null;

    // 2. Load goal and verify owner
    const goalDoc = await db.collection("goals").doc(validated.goalId).get();
    if (!goalDoc.exists) {
      throw new ApiError("Goal not found.", 404);
    }
    const goal = goalDoc.data() as any;
    if (goal.userId !== userId) {
      throw new ApiError("Access denied: You do not own this goal.", 403);
    }

    // 3. Ensure research data exists first
    if (!research) {
      throw new ApiError(
        "AI research data is required to write personalized outreach. Trigger research first.",
        400
      );
    }

    // 4. Generate draft content using OutreachAgent
    const aiDraft = await OutreachAgent.run(userId, {
      contactName: contact.name,
      role: contact.role,
      company: contact.company,
      notes: contact.notes ?? undefined,
      userGoals: `${goal.title}: ${goal.description || ""}`,
      companyInfo: research.data?.companyInfo,
      professionalBackground: research.data?.professionalBackground,
      keyInsights: research.data?.keyInsights,
      recentNews: research.data?.recentNews,
      additionalPrompt: validated.additionalPrompt,
    });

    // 5. Check if user has connected Gmail and attempt to create a draft in Gmail
    const googleConnDoc = await db.collection("google_connections").doc(userId).get();
    const googleConn = googleConnDoc.exists ? googleConnDoc.data() : null;

    let gmailDraftId: string | undefined = undefined;
    let gmailThreadId: string | undefined = undefined;

    const emailBody = aiDraft.variants?.[0] || "";

    if (googleConn) {
      try {
        const draftResult = await createGmailDraft(
          userId,
          contact.email,
          aiDraft.subject,
          emailBody
        );
        gmailDraftId = draftResult.draftId ?? undefined;
        gmailThreadId = draftResult.threadId ?? undefined;
      } catch (gmailError) {
        console.warn("⚠️ Failed to automatically create Gmail draft:", gmailError);
      }
    }

    // 6. Record the outreach draft in the Firestore outreach_threads collection
    const missionId = validated.missionId || contact.missionId || null;
    const threadRef = db.collection("outreach_threads").doc();
    const threadData = {
      userId,
      contactId: validated.contactId,
      missionId,
      gmailThreadId: gmailThreadId || `local_${Date.now()}`,
      gmailLastMessageId: gmailDraftId || null,
      subject: aiDraft.subject,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    };

    await threadRef.set(threadData);

    if (missionId) {
      await MissionBackgroundProcessor.logEvent(
        userId,
        missionId,
        "gmail_thread",
        `Drafted email thread: "${aiDraft.subject}"`,
        { threadId: threadRef.id, contactId: validated.contactId, subject: aiDraft.subject, status: "DRAFT" }
      );
    }

    // 7. Update contact relationship status to CONTACTED (outreach initiated)
    await db.collection("contacts").doc(validated.contactId).update({
      relationshipStatus: RelationshipStatus.CONTACTED,
      goalId: goalDoc.id,
      updatedAt: now,
    });

    try {
      await publishRCPEvent(userId, "contact_updated", {
        contactId: validated.contactId,
        name: contact?.name || null,
        status: RelationshipStatus.CONTACTED,
        relationshipStatus: RelationshipStatus.CONTACTED,
      });
    } catch (e) {
      console.warn("Failed to publish contact_updated RCP event:", e);
    }

    // 8. Log outreach event to the Audit Trail
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: AuditAction.EMAIL_GENERATED,
      details: JSON.stringify({
        contactId: validated.contactId,
        threadId: threadRef.id,
        gmailDraftId,
      }),
      userAgent,
      createdAt: now,
    });

    return NextResponse.json({
      threadId: threadRef.id,
      subject: aiDraft.subject,
      body: emailBody,
      variants: aiDraft.variants,
      gmailDraftId,
      gmailThreadId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
