import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { getGmailClient } from "@/lib/gmail/client";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

// Helper to decode base64 email bodies recursively
function getMessageBody(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    } catch {
      return "";
    }
  }

  if (payload.parts) {
    let htmlFallback = "";
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        try {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        } catch {}
      }
      if (part.mimeType === "text/html" && part.body?.data) {
        try {
          htmlFallback = Buffer.from(part.body.data, "base64").toString("utf-8");
        } catch {}
      }
      if (part.parts) {
        const bodyText = getMessageBody(part);
        if (bodyText) return bodyText;
      }
    }
    if (htmlFallback) {
      // Strip simple html tags for a cleaner text display
      return htmlFallback.replace(/<[^>]+>/g, " ").trim();
    }
  }

  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    } catch {}
  }

  return "";
}

/**
 * GET /api/gmail/threads/[id] - Retrieve all messages for a specific Gmail thread
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const { id } = await params;

    const gmail = await getGmailClient(userId);

    const threadDetails = await gmail.users.threads.get({
      userId: "me",
      id: id,
      format: "full",
    });

    const messagesData = threadDetails.data.messages || [];
    const messages = messagesData.map((message) => {
      const headers = message.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
      const toHeader = headers.find((h) => h.name?.toLowerCase() === "to")?.value || "";
      const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
      const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";

      const body = getMessageBody(message.payload);

      return {
        id: message.id,
        snippet: message.snippet || "",
        from: fromHeader,
        to: toHeader,
        date: dateHeader,
        subject: subjectHeader,
        body: body || message.snippet || "",
      };
    });

    return NextResponse.json({
      threadId: id,
      messages,
    });
  } catch (error: any) {
    const errMsg = error.message || "";
    if (
      errMsg.includes("invalid_grant") ||
      errMsg.includes("expired or revoked") ||
      error.status === 400 ||
      error.status === 401 ||
      error.code === 401 ||
      error.code === "invalid_grant"
    ) {
      return NextResponse.json(
        {
          error: "Gmail Authorization Failure",
          message: "Gmail connection has been revoked or expired. Please reconnect.",
        },
        { status: 401 }
      );
    }
    return handleApiError(error);
  }
}
