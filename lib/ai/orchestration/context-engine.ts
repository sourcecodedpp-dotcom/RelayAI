import { db } from "@/lib/db/firestore";
import { MemoryService } from "../memory/memory";

export interface ContactContext {
  userGoals: string;
  contactName: string;
  company: string;
  role: string;
  notes: string;
  companyInfo: string;
  professionalBackground: string;
  keyInsights: string;
  recentNews: string;
  threadSummary: string;
  followUpHistory: string;
}

export interface BriefingContext {
  userGoals: string;
  pipelineSummary: string;
}

export class ContextEngine {
  /**
   * Assembles all strategic context before communicating with a specific contact.
   * Delegates shared data fetching to MemoryService to eliminate duplication.
   */
  static async assembleContactContext(userId: string, contactId: string): Promise<ContactContext> {
    // 1. Fetch User Goals via MemoryService
    let userGoals = "None specified. Act as a general relationship assistant.";
    try {
      const prefs = await MemoryService.getUserPreferences(userId);
      if (prefs) userGoals = prefs;
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch user profile goals:", err);
    }

    // 2. Fetch Contact Profile
    let contactName = "";
    let company = "";
    let role = "";
    let notes = "None";
    try {
      const contactDoc = await db.collection("contacts").doc(contactId).get();
      if (contactDoc.exists) {
        const cData = contactDoc.data() as any;
        contactName = cData.name || "";
        company = cData.company || "";
        role = cData.role || "";
        notes = cData.notes || "None";
      }
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch contact profile:", err);
    }

    // 3. Fetch Research Insights via MemoryService
    let companyInfo = "None";
    let professionalBackground = "None";
    let keyInsights = "None";
    let recentNews = "None";
    try {
      const insights = await MemoryService.getResearchInsights(userId, [contactId]);
      if (insights.length > 0) {
        keyInsights = insights[0].keyInsights || "None";
        recentNews = insights[0].recentNews || "None";
      }
      // Still fetch full research doc for fields not in MemoryService return type
      const researchDoc = await db.collection("research").doc(contactId).get();
      if (researchDoc.exists) {
        const rData = researchDoc.data() as any;
        if (rData?.data) {
          companyInfo = rData.data.companyInfo || "None";
          professionalBackground = rData.data.professionalBackground || "None";
        }
      }
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch research insights:", err);
    }

    // 4. Fetch Message Thread Summaries (Gmail context)
    let threadSummary = "No active conversation threads.";
    try {
      const threads = await MemoryService.getGmailContext(userId, [contactId]);
      if (threads.length > 0) {
        threadSummary = threads
          .map((t) => `Subject: "${t.subject}" [Status: ${t.status}]`)
          .join("; ");
      }
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch threads:", err);
    }

    // 5. Fetch Follow-up History
    let followUpHistory = "No scheduled follow-up actions recorded.";
    try {
      const followUpsSnapshot = await db.collection("follow_ups")
        .where("userId", "==", userId)
        .where("contactId", "==", contactId)
        .get();

      if (!followUpsSnapshot.empty) {
        const followUpsList = followUpsSnapshot.docs.map((doc) => {
          const f = doc.data();
          return `Action: "${f.title || "Follow-up"}" [Status: ${f.status || "PENDING"}, Scheduled: ${f.scheduledAt || ""}]`;
        });
        followUpHistory = followUpsList.join("; ");
      }
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch followups:", err);
    }

    return {
      userGoals,
      contactName,
      company,
      role,
      notes,
      companyInfo,
      professionalBackground,
      keyInsights,
      recentNews,
      threadSummary,
      followUpHistory,
    };
  }

  /**
   * Assembles broad system context for daily briefings.
   * Delegates to MemoryService for shared data fetching.
   */
  static async assembleBriefingContext(userId: string): Promise<BriefingContext> {
    // 1. Fetch User Goals via MemoryService
    let userGoals = "None specified.";
    try {
      const prefs = await MemoryService.getUserPreferences(userId);
      if (prefs) userGoals = prefs;
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch user goals for briefing:", err);
    }

    // 2. Fetch Active Opportunities via MemoryService
    let pipelineSummary = "No pending relationship opportunities.";
    try {
      const opps = await MemoryService.getRecentOpportunities(userId);
      if (opps.length > 0) {
        const oppList = opps.map((o) =>
          `- Opportunity: "${o.title}" [Priority: ${o.priority}, Score: ${o.score}] - ${o.description}`
        );
        pipelineSummary = oppList.join("\n");
      }
    } catch (err) {
      console.warn("ContextEngine: Failed to fetch opportunities for briefing:", err);
    }

    return {
      userGoals,
      pipelineSummary,
    };
  }
}
export default ContextEngine;
