import { google } from "googleapis";
import { db } from "@/lib/db/firestore";
import { decryptToken, encryptToken } from "@/lib/security/crypto";

/**
 * Instantiates and returns an authenticated Google Gmail Client for the tenant.
 * Automatically handles access token refreshes and rotates refresh tokens if needed.
 */
export async function getGmailClient(userId: string) {
  const connectionDoc = await db.collection("google_connections").doc(userId).get();

  if (!connectionDoc.exists) {
    throw new Error("Gmail connection missing. Please link your Google Account.");
  }

  const connection = connectionDoc.data();
  if (!connection?.encryptedRefreshToken) {
    throw new Error("Encrypted Gmail token is missing from connection registry.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  const decryptedRefreshToken = decryptToken(
    connection.encryptedRefreshToken,
    connection.keyVersion || "1"
  );

  oauth2Client.setCredentials({
    refresh_token: decryptedRefreshToken,
  });

  // Automatically listen for and persist updated refresh tokens if Google rotates them
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      const { ciphertext, version } = encryptToken(tokens.refresh_token);
      await db.collection("google_connections").doc(userId).update({
        encryptedRefreshToken: ciphertext,
        keyVersion: version,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Creates a draft email in the user's Gmail mailbox.
 */
export async function createGmailDraft(
  userId: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
) {
  const gmail = await getGmailClient(userId);

  // Format RFC 2822 email payload
  const emailHeaders = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  const base64EncodedEmail = Buffer.from(emailHeaders)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: base64EncodedEmail,
        threadId: threadId,
      },
    },
  });

  return {
    draftId: response.data.id,
    messageId: response.data.message?.id,
    threadId: response.data.message?.threadId,
  };
}

/**
 * Sends an email directly via the user's Gmail mailbox.
 */
export async function sendGmailEmail(
  userId: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
) {
  const gmail = await getGmailClient(userId);

  const emailHeaders = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  const base64EncodedEmail = Buffer.from(emailHeaders)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: base64EncodedEmail,
      threadId: threadId,
    },
  });

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
  };
}

/**
 * Fetches Gmail thread headers (metadata only, to avoid violating privacy compliance).
 */
export async function getGmailThreadHeaders(userId: string, threadId: string) {
  const gmail = await getGmailClient(userId);
  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
  });
  return response.data;
}

/**
 * Inspects a Gmail thread to detect if a contact has replied to the user's outreach.
 */
export async function checkThreadForReply(
  userId: string,
  threadId: string,
  userEmail: string
): Promise<boolean> {
  const thread = await getGmailThreadHeaders(userId, threadId);
  if (!thread.messages || thread.messages.length <= 1) {
    return false;
  }

  const subsequentMessages = thread.messages.slice(1);
  for (const message of subsequentMessages) {
    const headers = message.payload?.headers;
    const fromHeader = headers?.find((h) => h.name?.toLowerCase() === "from")?.value || "";

    if (fromHeader && !fromHeader.toLowerCase().includes(userEmail.toLowerCase())) {
      return true;
    }
  }

  return false;
}
