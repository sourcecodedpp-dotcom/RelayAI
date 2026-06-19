import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { BriefingAgent } from "@/lib/ai/agents/briefing-agent";
import { ContextEngine } from "@/lib/ai/orchestration/context-engine";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();

    // Assemble briefing context
    const context = await ContextEngine.assembleBriefingContext(userId);

    // Generate daily summary headline using BriefingAgent
    const briefingResult = await BriefingAgent.run(userId, {
      userGoals: context.userGoals,
      pipelineSummary: context.pipelineSummary,
    });

    return NextResponse.json(briefingResult);
  } catch (error) {
    return handleApiError(error);
  }
}
