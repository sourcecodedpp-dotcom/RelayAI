import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError, ApiError } from "@/lib/security/errors";
import { MissionBackgroundProcessor } from "@/lib/ai/orchestration/mission-background";
import { publishRCPEvent } from "@/lib/rcp/processor";

export const dynamic = "force-dynamic";
import { FollowUpStatus, AuditAction, OpportunityStatus } from "@/types";
import { z } from "zod";

const createFollowUpSchema = z.object({
  contactId: z.string().min(1, "Invalid contact ID."),
  title: z.string().min(1, "Follow-up title is required."),
  scheduledAt: z.string().transform((str) => new Date(str).toISOString()),
  missionId: z.string().optional().nullable(),
});

const updateFollowUpSchema = z.object({
  id: z.string().min(1, "Invalid follow-up ID."),
  status: z.nativeEnum(FollowUpStatus).optional(),
  scheduledAt: z.string().transform((str) => new Date(str).toISOString()).optional(),
});

/**
 * GET /api/followups - Fetch all followups of the current user (resolving linked contacts)
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    const snapshot = await db.collection("follow_ups")
      .where("userId", "==", userId)
      .get();

    const followUps: any[] = [];

    for (const doc of snapshot.docs) {
      const followup = { id: doc.id, ...doc.data() } as any;

      // Resolve associated Contact details
      const contactDoc = await db.collection("contacts").doc(followup.contactId).get();
      followup.contact = contactDoc.exists ? { id: contactDoc.id, ...contactDoc.data() } : null;

      followUps.push(followup);
    }

    return NextResponse.json(followUps);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/followups - Schedule a new follow-up action
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = createFollowUpSchema.parse(body);

    const now = new Date().toISOString();

    // Verify contact owner
    const contactDoc = await db.collection("contacts").doc(validated.contactId).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      throw new ApiError("Contact not found or access denied.", 404);
    }
    const contactData = contactDoc.data();
    const missionId = validated.missionId || contactData?.missionId || null;

    const followupRef = db.collection("follow_ups").doc();
    const followupData = {
      userId,
      contactId: validated.contactId,
      missionId,
      title: validated.title,
      scheduledAt: validated.scheduledAt,
      status: FollowUpStatus.PENDING,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await followupRef.set(followupData);

    try {
      await publishRCPEvent(userId, "follow_up_created", {
        followUpId: followupRef.id,
        title: validated.title,
        contactId: validated.contactId,
        scheduledAt: validated.scheduledAt,
      });
    } catch (e) {
      console.warn("Failed to publish follow_up_created RCP event:", e);
    }

    if (missionId) {
      await MissionBackgroundProcessor.logEvent(
        userId,
        missionId,
        "follow_up",
        `Scheduled follow-up: "${validated.title}" for ${new Date(validated.scheduledAt).toLocaleString()}`,
        { followUpId: followupRef.id, contactId: validated.contactId, title: validated.title }
      );
    }

    // Write to audit trail
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: AuditAction.FOLLOW_UP_ACTION,
      details: JSON.stringify({ followUpId: followupRef.id, title: validated.title, action: "scheduled" }),
      userAgent,
      createdAt: now,
    });

    return NextResponse.json({ id: followupRef.id, ...followupData }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/followups - Update status or reschedule
 */
export async function PATCH(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = updateFollowUpSchema.parse(body);

    const now = new Date().toISOString();

    const followupRef = db.collection("follow_ups").doc(validated.id);
    const followupDoc = await followupRef.get();

    if (!followupDoc.exists || followupDoc.data()?.userId !== userId) {
      throw new ApiError("Follow-up not found or access denied.", 404);
    }

    const existing = followupDoc.data() as any;

    const updatedData = {
      status: validated.status ?? existing.status,
      scheduledAt: validated.scheduledAt ?? existing.scheduledAt,
      completedAt: validated.status === FollowUpStatus.COMPLETED ? now : existing.completedAt,
      updatedAt: now,
    };

    await followupRef.update(updatedData);

    if (validated.status === FollowUpStatus.COMPLETED) {
      try {
        await publishRCPEvent(userId, "follow_up_completed", {
          followUpId: validated.id,
          title: existing.title || null,
        });
      } catch (e) {
        console.warn("Failed to publish follow_up_completed RCP event:", e);
      }
    }

    // If completed, dismiss the corresponding opportunity in the briefing engine
    if (validated.status === FollowUpStatus.COMPLETED) {
      const oppsSnapshot = await db.collection("opportunities")
        .where("userId", "==", userId)
        .where("followUpId", "==", validated.id)
        .where("status", "==", OpportunityStatus.PENDING)
        .get();

      const batch = db.batch();
      oppsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: OpportunityStatus.COMPLETED,
          updatedAt: now,
        });
      });
      await batch.commit();
    }

    // Write to audit trail
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: AuditAction.FOLLOW_UP_ACTION,
      details: JSON.stringify({ 
        followUpId: validated.id, 
        title: existing.title, 
        action: validated.status === FollowUpStatus.COMPLETED ? "completed" : "rescheduled" 
      }),
      userAgent,
      createdAt: now,
    });

    return NextResponse.json({ id: validated.id, ...existing, ...updatedData });
  } catch (error) {
    return handleApiError(error);
  }
}
