import { NextResponse } from "next/server";
import { getAuthenticatedUserOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db/firestore";
import { getProvider } from "@/lib/ai/providers/base";
import { handleApiError } from "@/lib/security/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/api-monitor - Retrieve real-time connectivity status and diagnostics
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserOrThrow();
    const startTime = Date.now();

    // 1. Retrieve Firestore collection statistics
    const contactsSnap = await db.collection("contacts").where("userId", "==", userId).get();
    const oppsSnap = await db.collection("opportunities").where("userId", "==", userId).get();
    const goalsSnap = await db.collection("goals").where("userId", "==", userId).get();
    const followUpsSnap = await db.collection("follow_ups").where("userId", "==", userId).get();
    const dbLatency = Date.now() - startTime;

    // 2. Check Google integration credentials
    const googleDoc = await db.collection("google_connections").doc(userId).get();
    const googleConnected = googleDoc.exists;
    const googleEmail = googleConnected ? googleDoc.data()?.email : null;

    // 3. Test Inception Labs Mercury API connection
    let mercuryStatus = "UNCONFIGURED";
    let mercuryModel = "mercury-2";
    let mercuryLatency = null;
    let mercuryError = null;

    if (process.env.MERCURY_API_KEY) {
      try {
        const provider = getProvider();
        const startMerc = Date.now();
        
        // Lightweight call to check key validity
        if (provider.constructor.name === "MercuryProvider") {
          await provider.generate({
            prompt: "ping",
            temperature: 0.1,
          });
          mercuryStatus = "ACTIVE";
          mercuryLatency = Date.now() - startMerc;
        } else {
          mercuryStatus = "MOCK_ACTIVE";
        }
      } catch (err: any) {
        if (err.message?.includes("401") || err.message?.includes("authentication")) {
          mercuryStatus = "UNAUTHORIZED";
        } else {
          mercuryStatus = "ERROR";
        }
        mercuryError = err.message || "Failed API key check.";
      }
    }

    // 4. Retrieve recent security audit logs
    const auditLogsSnap = await db.collection("audit_logs")
      .where("userId", "==", userId)
      .get();
    
    const logs = auditLogsSnap.docs.map((doc) => {
      const data = doc.data();
      // Handle potential Firestore Timestamps or String dates
      const createdVal = data.createdAt;
      let timestamp = 0;
      if (createdVal) {
        if (createdVal.seconds !== undefined) {
          timestamp = createdVal.seconds * 1000;
        } else {
          timestamp = new Date(createdVal).getTime();
        }
      }
      return {
        id: doc.id,
        ...data,
        _timestamp: timestamp,
      };
    });

    // Sort in memory by timestamp descending
    logs.sort((a, b) => b._timestamp - a._timestamp);
    const finalLogs = logs.slice(0, 5).map(({ _timestamp, ...rest }) => rest);

    return NextResponse.json({
      db: {
        status: "CONNECTED",
        latencyMs: dbLatency,
        counts: {
          contacts: contactsSnap.size,
          opportunities: oppsSnap.size,
          goals: goalsSnap.size,
          followups: followUpsSnap.size,
        },
      },
      google: {
        status: googleConnected ? "CONNECTED" : "DISCONNECTED",
        email: googleEmail,
      },
      mercury: {
        status: mercuryStatus,
        model: mercuryModel,
        latencyMs: mercuryLatency,
        error: mercuryError,
        provider: process.env.AI_PROVIDER || "mercury",
      },
      logs: finalLogs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
