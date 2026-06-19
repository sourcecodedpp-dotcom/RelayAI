import { db } from "@/lib/db/firestore";
import { OpportunityType, OpportunityPriority, OpportunityStatus } from "@/types";

export class OpportunityEngine {
  /**
   * Generates a high-priority opportunity when an investor reply is detected.
   */
  static async handleInvestorReply(
    userId: string,
    contactId: string,
    threadId: string,
    contactName: string,
    company: string
  ) {
    const now = new Date().toISOString();

    // 1. Dismiss any existing follow-up opportunities for this contact
    const oppsSnapshot = await db.collection("opportunities")
      .where("userId", "==", userId)
      .where("contactId", "==", contactId)
      .where("type", "==", OpportunityType.FOLLOW_UP_DUE)
      .where("status", "==", OpportunityStatus.PENDING)
      .get();

    const batch = db.batch();
    oppsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: OpportunityStatus.DISMISSED,
        updatedAt: now,
      });
    });
    await batch.commit();

    // 2. Check if there is already a reply opportunity pending for this thread
    const existingSnapshot = await db.collection("opportunities")
      .where("userId", "==", userId)
      .where("contactId", "==", contactId)
      .where("outreachThreadId", "==", threadId)
      .where("type", "==", OpportunityType.INVESTOR_REPLIED)
      .where("status", "==", OpportunityStatus.PENDING)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const doc = existingSnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    // 3. Create new Reply opportunity
    const contactDoc = await db.collection("contacts").doc(contactId).get();
    const missionId = contactDoc.exists ? contactDoc.data()?.missionId || null : null;

    const newOppRef = db.collection("opportunities").doc();
    const opportunityData = {
      userId,
      contactId,
      missionId,
      outreachThreadId: threadId,
      followUpId: null,
      type: OpportunityType.INVESTOR_REPLIED,
      priority: OpportunityPriority.HIGH,
      title: `Reply from ${contactName} (${company})`,
      description: `${contactName} has responded to your outreach thread. Draft a personalized follow-up as soon as possible to maintain momentum.`,
      priorityScore: 90,
      confidenceScore: 0.95,
      status: OpportunityStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    await newOppRef.set(opportunityData);

    if (missionId) {
      const { MissionBackgroundProcessor } = await import("./mission-background");
      await MissionBackgroundProcessor.logEvent(
        userId,
        missionId,
        "opportunity",
        `New opportunity: Reply from ${contactName} (${company})`,
        { opportunityId: newOppRef.id, contactId, outreachThreadId: threadId }
      );
    }

    return { id: newOppRef.id, ...opportunityData };
  }

  /**
   * Generates an opportunity when a follow-up becomes due.
   */
  static async triggerFollowUpDueOpportunity(
    userId: string,
    contactId: string,
    followUpId: string,
    contactName: string,
    followUpTitle: string
  ) {
    const now = new Date().toISOString();

    const existingSnapshot = await db.collection("opportunities")
      .where("userId", "==", userId)
      .where("contactId", "==", contactId)
      .where("followUpId", "==", followUpId)
      .where("type", "==", OpportunityType.FOLLOW_UP_DUE)
      .where("status", "==", OpportunityStatus.PENDING)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const doc = existingSnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    const contactDoc = await db.collection("contacts").doc(contactId).get();
    const missionId = contactDoc.exists ? contactDoc.data()?.missionId || null : null;

    const newOppRef = db.collection("opportunities").doc();
    const opportunityData = {
      userId,
      contactId,
      missionId,
      outreachThreadId: null,
      followUpId,
      type: OpportunityType.FOLLOW_UP_DUE,
      priority: OpportunityPriority.MEDIUM,
      title: `Follow-up Due: ${contactName}`,
      description: `Your scheduled follow-up "${followUpTitle}" is now due. Review research context and generate a draft.`,
      priorityScore: 80,
      confidenceScore: 0.85,
      status: OpportunityStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    await newOppRef.set(opportunityData);

    if (missionId) {
      const { MissionBackgroundProcessor } = await import("./mission-background");
      await MissionBackgroundProcessor.logEvent(
        userId,
        missionId,
        "opportunity",
        `New opportunity: Follow-up Due: ${contactName} ("${followUpTitle}")`,
        { opportunityId: newOppRef.id, contactId, followUpId }
      );
    }

    return { id: newOppRef.id, ...opportunityData };
  }

  /**
   * Generates an opportunity when AI research discovers a highly relevant contact.
   */
  static async triggerNewContactOpportunity(
    userId: string,
    contactId: string,
    contactName: string,
    company: string,
    role: string
  ) {
    const now = new Date().toISOString();

    const existingSnapshot = await db.collection("opportunities")
      .where("userId", "==", userId)
      .where("contactId", "==", contactId)
      .where("type", "==", "NEW_CONTACT_DISCOVERED")
      .where("status", "==", OpportunityStatus.PENDING)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const doc = existingSnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    const contactDoc = await db.collection("contacts").doc(contactId).get();
    const missionId = contactDoc.exists ? contactDoc.data()?.missionId || null : null;

    const newOppRef = db.collection("opportunities").doc();
    const opportunityData = {
      userId,
      contactId,
      missionId,
      outreachThreadId: null,
      followUpId: null,
      type: "NEW_CONTACT_DISCOVERED",
      priority: OpportunityPriority.LOW,
      title: `Target Profile: ${contactName}`,
      description: `Discovered ${contactName}, ${role} at ${company}. Matches outreach goals. Trigger research to evaluate fit.`,
      priorityScore: 50,
      confidenceScore: 0.75,
      status: OpportunityStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    await newOppRef.set(opportunityData);

    if (missionId) {
      const { MissionBackgroundProcessor } = await import("./mission-background");
      await MissionBackgroundProcessor.logEvent(
        userId,
        missionId,
        "opportunity",
        `New opportunity: Target Profile: ${contactName} (${role} at ${company})`,
        { opportunityId: newOppRef.id, contactId }
      );
    }

    return { id: newOppRef.id, ...opportunityData };
  }
}
export default OpportunityEngine;
