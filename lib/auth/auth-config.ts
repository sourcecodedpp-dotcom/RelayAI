import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db/firestore";
import { env } from "@/lib/env";
import { encryptToken } from "@/lib/security/crypto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Segregated Scopes: Request only identity profile during login
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      if (!user.email) return false;

      // 1. Resolve user document by email or create if not present
      const usersRef = db.collection("users");
      const userSnapshot = await usersRef.where("email", "==", user.email).limit(1).get();
      
      let userId = "";

      if (userSnapshot.empty) {
        // Create new user document
        const newDocRef = usersRef.doc();
        userId = newDocRef.id;
        
        await newDocRef.set({
          email: user.email,
          name: user.name ?? null,
          avatarUrl: user.image ?? null,
          onboardingCompleted: false,
          primaryUseCase: null,
          outreachGoals: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        userId = userSnapshot.docs[0].id;
      }

      // 2. Google OAuth connections are handled during the explicit connect steps
      // in the app, rather than the initial sign in flow.

      // Store Firestore document ID in user object
      user.id = userId;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
});
export default handlers;
