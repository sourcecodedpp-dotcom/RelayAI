import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const UpdateMissionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  goalIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/missions/:id — Fetch a mission and its events
// ---------------------------------------------------------------------------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id: missionId } = await params;

    const missionRef = db.collection("missions").doc(missionId);
    const missionDoc = await missionRef.get();

    if (!missionDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Mission not found" },
        { status: 404 }
      );
    }

    const missionData = missionDoc.data();
    if (missionData?.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch mission events
    const eventsSnapshot = await db.collection("mission_events")
      .where("missionId", "==", missionId)
      .where("userId", "==", userId)
      .get();

    const events = eventsSnapshot.docs.map((doc) => ({
      eventId: doc.id,
      ...doc.data(),
    }));

    // Deterministic sort by sequenceNumber ascending
    events.sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    return NextResponse.json({
      success: true,
      mission: {
        missionId,
        id: missionId, // backward compatibility
        ...missionData
      },
      events,
    });
  } catch (error: any) {
    console.error("GET /api/missions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch mission" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/missions/:id — Update a mission
// ---------------------------------------------------------------------------

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id: missionId } = await params;
    const body = await req.json();

    const validation = UpdateMissionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    // Verify ownership
    const missionRef = db.collection("missions").doc(missionId);
    const missionDoc = await missionRef.get();

    if (!missionDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Mission not found" },
        { status: 404 }
      );
    }

    if (missionDoc.data()?.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const updates = validation.data;
    const now = new Date().toISOString();

    // If activating this mission, deactivate all others first
    if (updates.isActive === true) {
      const activeSnapshot = await db
        .collection("missions")
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .get();

      const batch = db.batch();
      activeSnapshot.docs.forEach((doc) => {
        if (doc.id !== missionId) {
          batch.update(doc.ref, { isActive: false, updatedAt: now });
        }
      });
      batch.update(missionRef, { ...updates, updatedAt: now });
      await batch.commit();
    } else {
      await missionRef.update({ ...updates, updatedAt: now });
    }

    const updatedDoc = await missionRef.get();

    console.log(`[Missions] Updated mission ${missionId} for user ${userId}`);

    return NextResponse.json({
      success: true,
      mission: { id: missionId, ...updatedDoc.data() },
    });
  } catch (error: any) {
    console.error("PATCH /api/missions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update mission" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/missions/:id — Deactivate (soft-delete) a mission
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id: missionId } = await params;

    const missionRef = db.collection("missions").doc(missionId);
    const missionDoc = await missionRef.get();

    if (!missionDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Mission not found" },
        { status: 404 }
      );
    }

    if (missionDoc.data()?.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Soft-delete: deactivate instead of removing
    await missionRef.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[Missions] Deactivated mission ${missionId} for user ${userId}`
    );

    return NextResponse.json({ success: true, deleted: missionId });
  } catch (error: any) {
    console.error("DELETE /api/missions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete mission" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}
