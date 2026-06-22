import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { decryptToken } from "@/lib/security/crypto";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    authenticated: false,
    refreshTokenExists: false,
    tokenDecrypts: false,
    gmailProfileLoaded: false,
    gmailAddress: "",
    grantedScopes: [] as string[],
    threadCount: 0,
    lastHistoryId: "",
    firestoreSyncEnabled: false,
    error: null as string | null,
  };

  try {
    // 1. Authenticate user
    let userId: string;
    try {
      userId = await getAuthenticatedUserOrThrow();
      result.authenticated = true;
    } catch (e: any) {
      result.error = `Authentication failed: ${e.message}`;
      return NextResponse.json(result);
    }

    // 2. Check firestore connection/write permissions
    try {
      const pingRef = db.collection("google_connections").doc("ping_test");
      await pingRef.set({ ping: true, updatedAt: new Date().toISOString() }, { merge: true });
      result.firestoreSyncEnabled = true;
    } catch (e: any) {
      console.error("Firestore sync test failed:", e);
    }

    // 3. Load google connection
    const connectionDoc = await db.collection("google_connections").doc(userId).get();
    if (!connectionDoc.exists) {
      result.error = "Google connection document not found in Firestore.";
      return NextResponse.json(result);
    }

    result.refreshTokenExists = true;
    const connection = connectionDoc.data();
    if (!connection?.encryptedRefreshToken) {
      result.error = "encryptedRefreshToken field is missing.";
      return NextResponse.json(result);
    }

    // 4. Token decryption
    let decryptedRefreshToken: string;
    try {
      decryptedRefreshToken = decryptToken(
        connection.encryptedRefreshToken,
        connection.keyVersion || "1"
      );
      result.tokenDecrypts = true;
    } catch (e: any) {
      result.error = `Token decryption failed: ${e.message}`;
      return NextResponse.json(result);
    }

    // 5. Initialize Google Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: decryptedRefreshToken,
    });

    // Get granted scopes
    try {
      await oauth2Client.getAccessToken();
      if (oauth2Client.credentials.scope) {
        result.grantedScopes = oauth2Client.credentials.scope.split(" ");
      }
    } catch (e: any) {
      result.error = `Failed to refresh access token: ${e.message}`;
      return NextResponse.json(result);
    }

    // 6. Gmail API Calls
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    try {
      const profile = await gmail.users.getProfile({ userId: "me" });
      result.gmailProfileLoaded = true;
      result.gmailAddress = profile.data.emailAddress || "";
      result.lastHistoryId = profile.data.historyId || "";
    } catch (e: any) {
      result.error = `Gmail getProfile failed: ${e.message}`;
      return NextResponse.json(result);
    }

    try {
      const threadsRes = await gmail.users.threads.list({
        userId: "me",
        maxResults: 10,
      });
      result.threadCount = threadsRes.data.threads?.length || 0;
    } catch (e: any) {
      result.error = `Gmail threads.list failed: ${e.message}`;
    }

  } catch (error: any) {
    result.error = error.message || "Unknown error occurred.";
  }

  return NextResponse.json(result);
}
