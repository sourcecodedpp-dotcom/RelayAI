/**
 * Memory Service — Goal-Centric Data Retrieval
 *
 * Replaces the unused AiMemory class with a comprehensive service
 * that fetches context from 12+ Firestore sources.
 *
 * Every function returns structured data for the Context Assembler.
 * No conversation history. Only goals, relationships, and commands.
 */

import { db } from "@/lib/db/firestore";
import type {
  Mission,
  EnrichedContact,
  CompanyContext,
  GmailThreadContext,
  CommandRecord,
  MAX_RECENT_COMMANDS,
  MAX_CONTEXT_CONTACTS,
  MAX_GMAIL_THREADS,
  MAX_OPPORTUNITIES,
  MAX_FOLLOW_UPS,
} from "./types";

// Re-import constants as values
const LIMITS = {
  RECENT_COMMANDS: 10,
  CONTEXT_CONTACTS: 10,
  GMAIL_THREADS: 10,
  OPPORTUNITIES: 8,
  FOLLOW_UPS: 10,
};

export class MemoryService {
  // -------------------------------------------------------------------------
  // 1. Mission
  // -------------------------------------------------------------------------

  static async getActiveMission(userId: string): Promise<Mission | null> {
    try {
      const snapshot = await db
        .collection("missions")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .get();

      if (snapshot.empty) return null;

      const docs = snapshot.docs.map(doc => ({ missionId: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime());

      return docs[0] as unknown as Mission;
    } catch (err) {
      console.warn("MemoryService: Failed to fetch active mission:", err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Goals
  // -------------------------------------------------------------------------

  /**
   * Returns goals linked to the active mission.
   * Falls back to all active goals if no mission is set.
   */
  static async getGoals(
    userId: string,
    missionId: string | null
  ): Promise<Array<{ id: string; title: string; description: string }>> {
    try {
      let mission: Mission | null = null;

      if (missionId) {
        const missionDoc = await db.collection("missions").doc(missionId).get();
        if (missionDoc.exists) {
          mission = { id: missionDoc.id, ...missionDoc.data() } as Mission;
        }
      }

      // If mission has linked goalIds, fetch those specific goals
      if (mission?.goalIds?.length) {
        const goals: Array<{ id: string; title: string; description: string }> = [];
        // Firestore 'in' query supports max 30 items
        const batchIds = mission.goalIds.slice(0, 30);
        const snapshot = await db
          .collection("goals")
          .where("userId", "==", userId)
          .where("__name__", "in", batchIds)
          .get();

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          goals.push({
            id: doc.id,
            title: data.title || "",
            description: data.description || "",
          });
        });
        return goals;
      }

      // Fallback: all active goals
      const snapshot = await db
        .collection("goals")
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "",
          description: data.description || "",
        };
      });
    } catch (err) {
      console.warn("MemoryService: Failed to fetch goals:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 3. Contacts
  // -------------------------------------------------------------------------

  /**
   * Returns contacts linked to mission goals, enriched with basic details.
   * Prioritizes by relationship strength (WARM > RESPONDED > CONTACTED > DISCOVERED > COLD).
   */
  static async getRelevantContacts(
    userId: string,
    missionId: string | null,
    limit: number = LIMITS.CONTEXT_CONTACTS
  ): Promise<EnrichedContact[]> {
    try {
      // Get mission goal IDs
      let goalIds: string[] = [];
      if (missionId) {
        const missionDoc = await db.collection("missions").doc(missionId).get();
        if (missionDoc.exists) {
          goalIds = (missionDoc.data() as any)?.goalIds || [];
        }
      }

      // Fetch contacts — filter by goal if mission has goals
      let snapshot;
      if (goalIds.length > 0 && goalIds.length <= 30) {
        snapshot = await db
          .collection("contacts")
          .where("userId", "==", userId)
          .where("goalId", "in", goalIds)
          .get();
      } else {
        snapshot = await db
          .collection("contacts")
          .where("userId", "==", userId)
          .get();
      }

      const statusOrder: Record<string, number> = {
        WARM: 5,
        RESPONDED: 4,
        CONTACTED: 3,
        DISCOVERED: 2,
        COLD: 1,
      };

      const contacts: EnrichedContact[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || "",
          company: d.company || "",
          role: d.role || "",
          email: d.email || "",
          notes: d.notes || "",
          relationshipStatus: d.relationshipStatus || "DISCOVERED",
          goalId: d.goalId || null,
        };
      });

      // Sort by relationship strength (strongest first)
      contacts.sort(
        (a, b) =>
          (statusOrder[b.relationshipStatus] || 0) -
          (statusOrder[a.relationshipStatus] || 0)
      );

      return contacts.slice(0, limit);
    } catch (err) {
      console.warn("MemoryService: Failed to fetch relevant contacts:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 4. Companies
  // -------------------------------------------------------------------------

  /**
   * Derives deduplicated company profiles from contacts and research data.
   * No separate companies collection needed.
   */
  static async getRelevantCompanies(
    userId: string,
    missionId: string | null
  ): Promise<CompanyContext[]> {
    try {
      const contacts = await this.getRelevantContacts(userId, missionId, 30);
      const companyMap = new Map<string, CompanyContext>();

      for (const contact of contacts) {
        if (!contact.company) continue;
        const key = contact.company.toLowerCase().trim();

        if (companyMap.has(key)) {
          const existing = companyMap.get(key)!;
          existing.contactCount++;
          existing.contactNames.push(contact.name);
        } else {
          companyMap.set(key, {
            name: contact.company,
            info: "",
            contactCount: 1,
            contactNames: [contact.name],
          });
        }
      }

      // Enrich with research data (companyInfo)
      const contactIds = contacts.map((c) => c.id);
      if (contactIds.length > 0) {
        // Batch fetch in groups of 30 (Firestore 'in' limit)
        for (let i = 0; i < contactIds.length; i += 30) {
          const batch = contactIds.slice(i, i + 30);
          const researchSnap = await db
            .collection("research")
            .where("contactId", "in", batch)
            .get();

          researchSnap.docs.forEach((doc) => {
            const rData = doc.data();
            const contactId = rData.contactId;
            const matchingContact = contacts.find((c) => c.id === contactId);
            if (matchingContact?.company) {
              const key = matchingContact.company.toLowerCase().trim();
              const company = companyMap.get(key);
              if (company && rData.data?.companyInfo && !company.info) {
                company.info = rData.data.companyInfo;
              }
            }
          });
        }
      }

      return Array.from(companyMap.values());
    } catch (err) {
      console.warn("MemoryService: Failed to fetch company context:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 5. Opportunities
  // -------------------------------------------------------------------------

  /**
   * Returns pending opportunities sorted by priority score (highest first).
   */
  static async getRecentOpportunities(
    userId: string,
    limit: number = LIMITS.OPPORTUNITIES
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      priority: string;
      score: number;
      type: string;
    }>
  > {
    try {
      const snapshot = await db
        .collection("opportunities")
        .where("userId", "==", userId)
        .where("status", "==", "PENDING")
        .get();

      const opps = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || "",
          description: d.description || "",
          priority: d.priority || "LOW",
          score: d.priorityScore || 0,
          type: d.type || "",
        };
      });

      // Sort by score descending
      opps.sort((a, b) => b.score - a.score);
      return opps.slice(0, limit);
    } catch (err) {
      console.warn("MemoryService: Failed to fetch opportunities:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 6. Gmail Context
  // -------------------------------------------------------------------------

  /**
   * Returns recent outreach thread metadata for the given contacts.
   * Metadata only — no message bodies.
   */
  static async getGmailContext(
    userId: string,
    contactIds: string[]
  ): Promise<GmailThreadContext[]> {
    if (!contactIds.length) return [];

    try {
      const threads: GmailThreadContext[] = [];

      // Batch fetch in groups of 30
      for (let i = 0; i < contactIds.length; i += 30) {
        const batch = contactIds.slice(i, i + 30);
        const snapshot = await db
          .collection("outreach_threads")
          .where("userId", "==", userId)
          .where("contactId", "in", batch)
          .get();

        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          threads.push({
            subject: d.subject || "No Subject",
            contactName: "", // will be enriched by caller
            status: d.status || "DRAFT",
            updatedAt: d.updatedAt || d.createdAt || "",
          });
        });
      }

      // Sort by most recent
      threads.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return threads.slice(0, LIMITS.GMAIL_THREADS);
    } catch (err) {
      console.warn("MemoryService: Failed to fetch Gmail context:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 7. User Preferences
  // -------------------------------------------------------------------------

  /**
   * Returns user profile goals + stored AI preferences.
   */
  static async getUserPreferences(userId: string): Promise<string> {
    try {
      // Fetch profile goals
      const userDoc = await db.collection("users").doc(userId).get();
      let profileStr = "";
      if (userDoc.exists) {
        const uData = userDoc.data() as any;
        const parts: string[] = [];
        if (uData.primaryUseCase) parts.push(`Use case: ${uData.primaryUseCase}`);
        if (uData.outreachGoals) parts.push(`Outreach goals: ${uData.outreachGoals}`);
        if (uData.name) parts.push(`Name: ${uData.name}`);
        profileStr = parts.join(". ");
      }

      // Fetch stored AI preferences from ai_memory
      const prefSnapshot = await db
        .collection("ai_memory")
        .where("userId", "==", userId)
        .where("type", "==", "preference")
        .limit(5)
        .get();

      const prefs = prefSnapshot.docs.map((doc) => doc.data().content as string);

      const allParts = [profileStr, ...prefs].filter(Boolean);

      if (allParts.length === 0) {
        return "Write direct, low-friction, high-value communication. Keep tone professional and brief.";
      }

      return allParts.join(". ");
    } catch (err) {
      console.warn("MemoryService: Failed to fetch user preferences:", err);
      return "Keep tone professional and brief.";
    }
  }

  // -------------------------------------------------------------------------
  // 8. Command History
  // -------------------------------------------------------------------------

  /**
   * Returns the most recent commands for behavioral continuity.
   * Stored separately from conversations.
   */
  static async getRecentCommands(
    userId: string,
    limit: number = LIMITS.RECENT_COMMANDS
  ): Promise<CommandRecord[]> {
    try {
      const snapshot = await db
        .collection("command_history")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CommandRecord[];
    } catch (err) {
      console.warn("MemoryService: Failed to fetch recent commands:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 9. Follow-Up History
  // -------------------------------------------------------------------------

  /**
   * Returns pending + recent follow-ups for contacts within the mission.
   */
  static async getFollowUpHistory(
    userId: string,
    missionId: string | null
  ): Promise<
    Array<{
      id: string;
      contactId: string;
      title: string;
      scheduledAt: string;
      status: string;
    }>
  > {
    try {
      // Get contacts linked to mission
      const contacts = await this.getRelevantContacts(userId, missionId, 30);
      const contactIds = contacts.map((c) => c.id);

      if (contactIds.length === 0) {
        // Fallback: all follow-ups for user
        const snapshot = await db
          .collection("follow_ups")
          .where("userId", "==", userId)
          .limit(LIMITS.FOLLOW_UPS)
          .get();

        return snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            contactId: d.contactId || "",
            title: d.title || "Follow-up",
            scheduledAt: d.scheduledAt || "",
            status: d.status || "PENDING",
          };
        });
      }

      const followUps: Array<{
        id: string;
        contactId: string;
        title: string;
        scheduledAt: string;
        status: string;
      }> = [];

      for (let i = 0; i < contactIds.length; i += 30) {
        const batch = contactIds.slice(i, i + 30);
        const snapshot = await db
          .collection("follow_ups")
          .where("userId", "==", userId)
          .where("contactId", "in", batch)
          .get();

        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          followUps.push({
            id: doc.id,
            contactId: d.contactId || "",
            title: d.title || "Follow-up",
            scheduledAt: d.scheduledAt || "",
            status: d.status || "PENDING",
          });
        });
      }

      // Sort: PENDING first, then by scheduledAt
      followUps.sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING") return -1;
        if (b.status === "PENDING" && a.status !== "PENDING") return 1;
        return (
          new Date(b.scheduledAt).getTime() -
          new Date(a.scheduledAt).getTime()
        );
      });

      return followUps.slice(0, LIMITS.FOLLOW_UPS);
    } catch (err) {
      console.warn("MemoryService: Failed to fetch follow-up history:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 10. Research Insights
  // -------------------------------------------------------------------------

  /**
   * Returns key research insights for a set of contacts.
   */
  static async getResearchInsights(
    userId: string,
    contactIds: string[]
  ): Promise<
    Array<{
      contactId: string;
      whyRelevant: string;
      keyInsights: string;
      recentNews: string;
    }>
  > {
    if (!contactIds.length) return [];

    try {
      const insights: Array<{
        contactId: string;
        whyRelevant: string;
        keyInsights: string;
        recentNews: string;
      }> = [];

      for (let i = 0; i < contactIds.length; i += 30) {
        const batch = contactIds.slice(i, i + 30);
        const snapshot = await db
          .collection("research")
          .where("contactId", "in", batch)
          .get();

        snapshot.docs.forEach((doc) => {
          const rData = doc.data();
          if (rData.data) {
            insights.push({
              contactId: rData.contactId || doc.id,
              whyRelevant: rData.data.whyRelevant || "",
              keyInsights: rData.data.keyInsights || "",
              recentNews: rData.data.recentNews || "",
            });
          }
        });
      }

      return insights;
    } catch (err) {
      console.warn("MemoryService: Failed to fetch research insights:", err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // User Profile (convenience)
  // -------------------------------------------------------------------------

  /**
   * Returns a concise user profile string for context injection.
   */
  static async getUserProfile(userId: string): Promise<string> {
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) return "Unknown user.";

      const u = userDoc.data() as any;
      const parts: string[] = [];
      if (u.name) parts.push(`Name: ${u.name}`);
      if (u.email) parts.push(`Email: ${u.email}`);
      if (u.primaryUseCase) parts.push(`Primary use case: ${u.primaryUseCase}`);
      if (u.outreachGoals) parts.push(`Outreach goals: ${u.outreachGoals}`);

      return parts.join(". ") || "User profile incomplete.";
    } catch (err) {
      console.warn("MemoryService: Failed to fetch user profile:", err);
      return "User profile unavailable.";
    }
  }
}

export default MemoryService;
