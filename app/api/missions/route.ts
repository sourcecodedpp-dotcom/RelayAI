import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateMissionSchema = z.object({
  title: z.string().min(1, "Mission title is required").max(200),
  description: z.string().max(1000).default(""),
  goalIds: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// GET /api/missions — List all missions for the authenticated user
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    const snapshot = await db
      .collection("missions")
      .where("userId", "==", userId)
      .get();

    const missions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort: active first, then by lastActivityAt descending
    missions.sort((a: any, b: any) => {
      const aActive = a.status === "active";
      const bActive = b.status === "active";
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return (
        new Date(b.lastActivityAt || b.createdAt || 0).getTime() -
        new Date(a.lastActivityAt || a.createdAt || 0).getTime()
      );
    });

    return NextResponse.json({ success: true, missions });
  } catch (error: any) {
    console.error("GET /api/missions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch missions" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/missions — Create a new mission (auto-deactivates previous active)
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();

    const validation = CreateMissionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { title, description, goalIds } = validation.data;
    const now = new Date().toISOString();

    // Deactivate any currently active missions
    const activeSnapshot = await db
      .collection("missions")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .get();

    const batch = db.batch();
    activeSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isActive: false, updatedAt: now });
    });

    // Create the new mission as active
    const newMissionRef = db.collection("missions").doc();
    batch.set(newMissionRef, {
      userId,
      title,
      description,
      summary: description || "",
      currentSummary: description || "",
      status: "active",
      isActive: true,
      goalIds,
      eventCount: 0,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    });

    await batch.commit();

    console.log(
      `[Missions] Created mission "${title}" (${newMissionRef.id}) for user ${userId}. Deactivated ${activeSnapshot.size} previous mission(s).`
    );

    return NextResponse.json({
      success: true,
      mission: {
        id: newMissionRef.id,
        userId,
        title,
        description,
        isActive: true,
        goalIds,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error: any) {
    console.error("POST /api/missions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create mission" },
      { status: error.message?.includes("401") ? 401 : 500 }
    );
  }
}
