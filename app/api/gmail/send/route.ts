import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { sendGmailEmail, createGmailDraft } from "@/lib/gmail/client";
import { handleApiError } from "@/lib/security/errors";
import { publishRCPEvent } from "@/lib/rcp/processor";
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

      try {
        await publishRCPEvent(userId, "email_sent", {
          recipient: validated.to,
          subject: validated.subject,
          threadId: validated.threadId || null,
          sentAt: new Date().toISOString(),
          status: "awaiting_reply",
        });
      } catch (e) {
        console.warn("Failed to publish email_sent RCP event:", e);
      }

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
