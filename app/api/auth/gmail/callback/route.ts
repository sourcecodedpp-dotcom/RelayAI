import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { google } from "googleapis";
import { db } from "@/lib/db/firestore";
import { env } from "@/lib/env";
import { encryptToken } from "@/lib/security/crypto";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/gmail/callback - Processes Google callback, exchanges token, and stores connection
 */
export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");

  const origin = urlObj.origin;

  try {
    // 1. Verify authenticated user session
    const userId = await getAuthenticatedUserOrThrow();

    // 2. CSRF Validation
    const cookieStore = await cookies();
    const savedState = cookieStore.get("gmail_oauth_state")?.value;

    if (!state || !savedState || state !== savedState) {
      console.warn("⚠️ CSRF state validation failed during Gmail connection.");
      return NextResponse.redirect(new URL("/settings?error=csrf_validation_failed", origin));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/settings?error=no_auth_code", origin));
    }

    const baseUrl = env.NODE_ENV === "production" 
      ? "https://labs-relay-ai.vercel.app" 
      : "http://localhost:3000";

    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/auth/gmail/callback`
    );

    // 3. Exchange Auth Code for Refresh & Access tokens
    const tokenRes = await oauth2Client.getToken(code);
    const tokens = tokenRes.tokens;

    if (!tokens.refresh_token) {
      console.warn("⚠️ Google did not return a refresh token. Forcing consent prompts.");
      return NextResponse.redirect(new URL("/settings?error=refresh_token_missing", origin));
    }

    // Set credentials for metadata retrieval
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    
    // 4. Retrieve connected mailbox email address directly from Google
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress;

    if (!emailAddress) {
      throw new Error("Unable to resolve Gmail mailbox address.");
    }

    // 5. Encrypt refresh token
    const { ciphertext, version } = encryptToken(tokens.refresh_token);

    const now = new Date().toISOString();

    // 6. Persist connection details in google_connections
    await db.collection("google_connections").doc(userId).set({
      userId,
      email: emailAddress,
      encryptedRefreshToken: ciphertext,
      keyVersion: version, // Key version tracking
      gmailHistoryId: null,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // Write audit log entry
    const userAgent = req.headers.get("user-agent") || null;
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      userId,
      action: "OAUTH_EVENT",
      details: JSON.stringify({ event: "gmail_connected", mailbox: emailAddress }),
      userAgent,
      createdAt: now,
    });

    // Clear CSRF cookie
    const response = NextResponse.redirect(new URL("/gmail?success=gmail_connected", origin));
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (error: any) {
    console.error("❌ Gmail OAuth Callback exception:", error);
    return NextResponse.redirect(new URL(`/settings?error=callback_failed&msg=${encodeURIComponent(error.message)}`, origin));
  }
}
