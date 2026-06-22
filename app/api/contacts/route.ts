import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";
import { MissionBackgroundProcessor } from "@/lib/ai/orchestration/mission-background";
import { publishRCPEvent } from "@/lib/rcp/processor";

export const dynamic = "force-dynamic";
import { RelationshipStatus } from "@/types";
import { z } from "zod";

const createContactSchema = z.object({
  name: z.string().min(1, "Contact name is required."),
  company: z.string().min(1, "Company name is required."),
  role: z.string().min(1, "Professional role is required."),
  email: z.string().email("A valid email address is required."),
  notes: z.string().optional(),
  goalId: z.string().uuid().optional().nullable(),
  relationshipStatus: z.nativeEnum(RelationshipStatus).optional().default(RelationshipStatus.DISCOVERED),
  missionId: z.string().optional().nullable(),
});

/**
 * GET /api/contacts - Fetch all contacts for the current user (resolving linked entities)
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    const snapshot = await db.collection("contacts")
      .where("userId", "==", userId)
      .get();

    const contacts: any[] = [];

    for (const doc of snapshot.docs) {
      const contact = { id: doc.id, ...doc.data() } as any;

      // 1. Resolve associated Goal doc
      if (contact.goalId) {
        const goalDoc = await db.collection("goals").doc(contact.goalId).get();
        contact.goal = goalDoc.exists ? { id: goalDoc.id, ...goalDoc.data() } : null;
      } else {
        contact.goal = null;
      }

      // 2. Resolve associated Research doc (document ID is contactId)
      const researchDoc = await db.collection("research").doc(contact.id).get();
      contact.research = researchDoc.exists ? { id: researchDoc.id, ...researchDoc.data() } : null;

      contacts.push(contact);
    }

    return NextResponse.json(contacts);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/contacts - Add a new contact to focus orbits
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = createContactSchema.parse(body);

    // Enforce tenant unique contact email
    const existingSnapshot = await db.collection("contacts")
      .where("userId", "==", userId)
      .where("email", "==", validated.email)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { error: "Conflict Error", message: "A contact with this email already exists." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const contactRef = db.collection("contacts").doc();

    const contactData = {
      userId,
      goalId: validated.goalId || null,
      missionId: validated.missionId || null,
      name: validated.name,
      company: validated.company,
      role: validated.role,
      email: validated.email,
      notes: validated.notes ?? null,
      relationshipStatus: validated.relationshipStatus,
      createdAt: now,
      updatedAt: now,
    };

    await contactRef.set(contactData);

    try {
      await publishRCPEvent(userId, "contact_created", {
        contactId: contactRef.id,
        name: validated.name,
        email: validated.email,
        company: validated.company,
        status: validated.relationshipStatus,
        missionId: validated.missionId || null,
      });
    } catch (e) {
      console.warn("Failed to publish contact_created RCP event:", e);
    }

    if (validated.missionId) {
      await MissionBackgroundProcessor.logEvent(
        userId,
        validated.missionId,
        "contact",
        `Added contact: ${validated.name} (${validated.role} at ${validated.company})`,
        { contactId: contactRef.id, email: validated.email, name: validated.name, company: validated.company }
      );
    }

    return NextResponse.json({ id: contactRef.id, ...contactData }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
