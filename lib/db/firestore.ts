import "@/lib/env";
import admin from "firebase-admin";
import { env } from "@/lib/env";

const isDummyKey = env.FIREBASE_PRIVATE_KEY.includes("REPLACE_WITH_YOUR_SERVICE_ACCOUNT_PRIVATE_KEY") || 
                   !env.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY");

if (!admin.apps.length && !isDummyKey) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error);
  }
}

// Lazy db reference using Proxy to avoid crashing on module load if Firebase is not initialized (e.g., during builds)
export const db = (admin.apps.length > 0)
  ? (() => {
      const f = admin.firestore();
      try {
        f.settings({ ignoreUndefinedProperties: true });
      } catch (e) {
        // settings() can only be called once, ignore if already set
      }
      return f;
    })()
  : new Proxy({} as admin.firestore.Firestore, {
      get(target, prop) {
        if (prop === "collection") {
          return () => ({
            add: async () => ({ id: "mock_id" }),
            doc: () => ({
              get: async () => ({ exists: false, data: () => null }),
              set: async () => {},
              update: async () => {},
              delete: async () => {},
            }),
            where: function() { return this; },
            orderBy: function() { return this; },
            get: async () => ({ docs: [] }),
          });
        }
        if (prop === "batch") {
          return () => ({
            update: () => {},
            commit: async () => {},
          });
        }
        return undefined;
      }
    });

export default db;
