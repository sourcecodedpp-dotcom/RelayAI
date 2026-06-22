import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { google } from "googleapis";
import crypto from "crypto";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/gmail - Redirects the user to Google OAuth consent screen for Gmail scopes
 */
export async function GET(req: Request) {
  try {
    // 1. Enforce user session
    await getAuthenticatedUserOrThrow();

    const baseUrl = env.NODE_ENV === "production" 
      ? "https://labs-relay-ai.vercel.app" 
      : "http://localhost:3000";

    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/auth/gmail/callback`
    );

    // 2. Generate secure CSRF validation state
    const csrfState = crypto.randomBytes(32).toString("hex");

    // 3. Generate Auth Consent URL specifically requesting Gmail API scopes
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
      state: csrfState,
    });

    const response = NextResponse.redirect(authUrl);

    // 4. Save state parameter in secure HTTP-only cookie
    response.cookies.set("gmail_oauth_state", csrfState, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("❌ Gmail OAuth initiation failed:", error);
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(new URL("/settings?error=initiation_failed", origin));
  }
}
