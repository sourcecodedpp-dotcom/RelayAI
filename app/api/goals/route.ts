import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";
import { AuditAction } from "@/types";
import { z } from "zod";

const createGoalSchema = z.object({
  title: z.string().min(1, "Goal title is required."),
  description: z.string().optional(),
});

/**
 * GET /api/goals - Fetch all active goals of the authenticated user
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    
    const snapshot = await db.collection("goals")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .get();

    const goals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(goals);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/goals - Define a new outreach goal
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = createGoalSchema.parse(body);

    const now = new Date().toISOString();
    const goalRef = db.collection("goals").doc();

    const goalData = {
      userId,
      title: validated.title,
      description: validated.description ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await goalRef.set(goalData);

    // Write to audit trail
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: AuditAction.GOAL_UPDATE,
      details: JSON.stringify({ goalId: goalRef.id, title: validated.title, status: "created" }),
      userAgent,
      createdAt: now,
    });

    return NextResponse.json({ id: goalRef.id, ...goalData }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
