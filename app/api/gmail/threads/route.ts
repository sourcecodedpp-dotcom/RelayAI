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

    // Build label filters based on folder
    let q = query;
    if (folder === "SENT") {
      q = `${q} label:sent`.trim();
    } else if (folder === "DRAFTS") {
      q = `${q} label:draft`.trim();
    } else {
      q = `${q} label:inbox`.trim();
    }

    // List recent threads
    const listResponse = await gmail.users.threads.list({
      userId: "me",
      q: q || undefined,
      maxResults: 20,
    });

    const threadsList = listResponse.data.threads || [];
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
  } catch (error) {
    return handleApiError(error);
  }
}
