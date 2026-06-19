import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { getProvider } from "@/lib/ai/providers/base";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";
import { z } from "zod";

const generateReplySchema = z.object({
  threadId: z.string().min(1, "Thread ID is required."),
  messages: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      date: z.string(),
      body: z.string(),
    })
  ).min(1, "Thread history messages are required."),
});

/**
 * POST /api/gmail/generate-reply - Draft a response using Mercury-2
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = generateReplySchema.parse(body);

    // Fetch user goals/objectives from settings to inject as contextual memory
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const primaryUseCase = userData.primaryUseCase || "general outreach";
    const outreachGoals = userData.outreachGoals || "build warm startup relationships";

    // Format the email history for the AI prompt
    const historyText = validated.messages
      .map((m) => {
        return `From: ${m.from}\nDate: ${m.date}\nContent:\n${m.body}\n------------------`;
      })
      .join("\n");

    const prompt = `
You are the AI Chief of Staff assistant for Relay AI.
Generate a professional, compelling, context-aware reply email to the email thread below.

Here is the context of the user:
- User Primary Use Case: "${primaryUseCase}"
- User Outreach Objectives & Pitch: "${outreachGoals}"

Below is the chronological message thread history:
==================
${historyText}
==================

Please draft a professional, concise, and engaging email reply on behalf of the user that aligns with their goals, addresses the latest message, and drives the conversation forward (e.g., suggesting a brief call or scheduling next steps).

DO NOT include placeholders (like [Your Name] or [Insert Date]). Use the user's details if known, or write a naturally flowing reply.
Return ONLY the email body text. Do not include markdown code block formatting or subject lines.
    `.trim();

    const provider = getProvider();
    const response = await provider.generate({
      prompt,
      systemInstruction: "You are a professional email advisor. Reply with only the email body text, no explanation.",
      temperature: 0.7,
    });

    return NextResponse.json({
      replyText: response.text.replace(/```(html|text|markdown)?/g, "").trim(),
      model: response.model,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
