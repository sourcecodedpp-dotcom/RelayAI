import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";
import { AuditAction } from "@/types";
import { z } from "zod";

const onboardingSchema = z.object({
  primaryUseCase: z.string().min(1, "Primary use case is required."),
  outreachGoals: z.string().min(1, "Outreach goals are required."),
});

/**
 * POST /api/onboarding - Complete onboarding profile
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = onboardingSchema.parse(body);

    const now = new Date().toISOString();

    // 1. Update user onboarding details
    await db.collection("users").doc(userId).update({
      primaryUseCase: validated.primaryUseCase,
      outreachGoals: validated.outreachGoals,
      onboardingCompleted: true,
      updatedAt: now,
    });

    // 2. Write to audit trail
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: AuditAction.OAUTH_EVENT,
      details: JSON.stringify({ event: "onboarding_completed", useCase: validated.primaryUseCase }),
      userAgent,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
