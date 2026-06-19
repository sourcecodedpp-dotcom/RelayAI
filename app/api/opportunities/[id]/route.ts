import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { handleApiError, ApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";
import { OpportunityStatus } from "@/types";
import { z } from "zod";

const updateOpportunitySchema = z.object({
  status: z.nativeEnum(OpportunityStatus),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/opportunities/[id] - Dismiss or complete an opportunity
 */
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id: opportunityId } = await context.params;
    const body = await req.json();
    const validated = updateOpportunitySchema.parse(body);

    const oppRef = db.collection("opportunities").doc(opportunityId);
    const opportunityDoc = await oppRef.get();

    if (!opportunityDoc.exists) {
      throw new ApiError("Opportunity not found.", 404);
    }

    const opportunity = opportunityDoc.data() as any;

    if (opportunity.userId !== userId) {
      throw new ApiError("Access denied: You do not own this opportunity.", 403);
    }

    await oppRef.update({
      status: validated.status,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ id: opportunityId, ...opportunity, status: validated.status });
  } catch (error) {
    return handleApiError(error);
  }
}
