import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { sendGmailEmail, createGmailDraft } from "@/lib/gmail/client";
import { handleApiError } from "@/lib/security/errors";
import { z } from "zod";

const sendEmailSchema = z.object({
  to: z.string().email("Invalid recipient email address."),
  subject: z.string().min(1, "Subject is required."),
  body: z.string().min(1, "Email body is required."),
  threadId: z.string().optional(),
  action: z.enum(["send", "draft"]),
});

/**
 * POST /api/gmail/send - Send a live email or compose a draft in Gmail
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const body = await req.json();
    const validated = sendEmailSchema.parse(body);

    if (validated.action === "send") {
      const result = await sendGmailEmail(
        userId,
        validated.to,
        validated.subject,
        validated.body,
        validated.threadId
      );
      return NextResponse.json({
        success: true,
        message: "Email sent successfully.",
        ...result,
      });
    } else {
      const result = await createGmailDraft(
        userId,
        validated.to,
        validated.subject,
        validated.body,
        validated.threadId
      );
      return NextResponse.json({
        success: true,
        message: "Draft created successfully.",
        ...result,
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
