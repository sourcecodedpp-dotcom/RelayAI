import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { getGmailClient } from "@/lib/gmail/client";
import { db } from "@/lib/db/firestore";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/threads - Retrieve recent Gmail threads with metadata and contact details
 */
export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    
    // Check if user has google connection
    const connectionDoc = await db.collection("google_connections").doc(userId).get();
    if (!connectionDoc.exists) {
      return NextResponse.json({ connected: false, threads: [] });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const folder = searchParams.get("folder") || "INBOX";

    const gmail = await getGmailClient(userId);

    // Map folder to Gmail labelIds
    const labelMap: Record<string, string[]> = {
      INBOX: ["INBOX"],
      SENT: ["SENT"],
      DRAFTS: ["DRAFT"],
    };

    const labelIds = labelMap[folder.toUpperCase()] || ["INBOX"];

    // List recent threads: reserve 'q' exclusively for search queries, use labelIds for folders.
    const listResponse = await gmail.users.threads.list({
      userId: "me",
      q: query || undefined,
      labelIds,
      maxResults: 25,
    });

    const threadsList = listResponse.data.threads || [];

    // Retrieve granted scopes for debug logging
    let scopes: string[] = [];
    try {
      const credentialsRes = await (gmail.context._options.auth as any).getAccessToken();
      if (credentialsRes.credentials?.scope) {
        scopes = credentialsRes.credentials.scope.split(" ");
      }
    } catch (scopeErr) {
      console.warn("Failed to retrieve scopes for logging:", scopeErr);
    }

    // Gmail debug logging
    console.log("[GMAIL DEBUG LOG]", {
      folderRequested: folder,
      labelIds,
      qParam: query || undefined,
      threadCount: threadsList.length,
      googleStatusCode: listResponse.status,
      grantedScopes: scopes,
    });

    const threads = [];

    // Fetch details for each thread
    for (const threadInfo of threadsList) {
      if (!threadInfo.id) continue;
      try {
        const threadDetails = await gmail.users.threads.get({
          userId: "me",
          id: threadInfo.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date", "To"],
        });

        const messages = threadDetails.data.messages || [];
        const lastMessage = messages[messages.length - 1];
        const headers = lastMessage?.payload?.headers || [];
        
        const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
        const toHeader = headers.find((h) => h.name?.toLowerCase() === "to")?.value || "";
        const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
        const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

        // Extract clean email from sender (e.g. "John Doe <john@example.com>")
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const fromEmail = emailMatch ? emailMatch[1] : fromHeader.trim();

        // Check if the contact exists in user's DB
        let contact = null;
        if (fromEmail) {
          const contactSnapshot = await db.collection("contacts")
            .where("userId", "==", userId)
            .where("email", "==", fromEmail.toLowerCase())
            .limit(1)
            .get();
          
          if (!contactSnapshot.empty) {
            const contactDoc = contactSnapshot.docs[0];
            contact = { id: contactDoc.id, ...contactDoc.data() };
          }
        }

        threads.push({
          id: threadInfo.id,
          snippet: threadInfo.snippet || lastMessage?.snippet || "",
          messageCount: messages.length,
          from: fromHeader,
          to: toHeader,
          fromEmail,
          subject: subjectHeader,
          date: dateHeader,
          contact,
        });
      } catch (err) {
        console.warn(`Failed to fetch thread metadata for ${threadInfo.id}:`, err);
      }
    }

    return NextResponse.json({ connected: true, threads });
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
