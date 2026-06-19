import { db } from "@/lib/db/firestore";
import { OpportunityStatus, OpportunityPriority } from "@/types";

export interface ScoreFactors {
  goalAlignment: number;       // 0 to 10
  relationshipStrength: number; // 0 to 10
  recentActivity: number;       // 0 to 10
  responseHistory: number;      // 0 to 10
  timeSensitivity: number;      // 0 to 10
}

export class PrioritizationAgent {
  /**
   * Recalculates priority scores for all pending opportunities belonging to a user.
   */
  static async recalculateScores(userId: string): Promise<void> {
    const now = new Date();
    
    try {
      // 1. Fetch pending opportunities
      const snapshot = await db.collection("opportunities")
        .where("userId", "==", userId)
        .where("status", "==", OpportunityStatus.PENDING)
        .get();

      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const opp = { id: doc.id, ...doc.data() } as any;
        
        // Fetch Contact details if available
        let contact: any = null;
        if (opp.contactId) {
          const contactDoc = await db.collection("contacts").doc(opp.contactId).get();
          if (contactDoc.exists) {
            contact = contactDoc.data();
          }
        }

        // Initialize scoring factors
        const factors: ScoreFactors = {
          goalAlignment: 5,
          relationshipStrength: 5,
          recentActivity: 5,
          responseHistory: 5,
          timeSensitivity: 5,
        };

        // Determine Base Score based on Opportunity Type
        let baseScore = 50;
        if (opp.type === "INVESTOR_REPLIED") {
          baseScore = 85;
          factors.responseHistory = 10;
          factors.timeSensitivity = 9;
        } else if (opp.type === "FOLLOW_UP_DUE") {
          baseScore = 75;
          factors.timeSensitivity = 8;
        } else if (opp.type === "NEW_CONTACT_DISCOVERED") {
          baseScore = 45;
          factors.relationshipStrength = 2;
        }

        // Adjust based on Goal Alignment
        if (contact && contact.goalId) {
          factors.goalAlignment = 9;
        }

        // Adjust based on Relationship Strength stage
        if (contact) {
          switch (contact.relationshipStatus) {
            case "WARM":
              factors.relationshipStrength = 10;
              break;
            case "RESPONDED":
              factors.relationshipStrength = 8;
              break;
            case "CONTACTED":
              factors.relationshipStrength = 6;
              break;
            case "DISCOVERED":
              factors.relationshipStrength = 3;
              break;
            case "COLD":
              factors.relationshipStrength = 2;
              break;
          }
        }

        // Adjust based on Time Sensitivity (Overdue followups)
        if (opp.type === "FOLLOW_UP_DUE" && opp.followUpId) {
          const followUpDoc = await db.collection("follow_ups").doc(opp.followUpId).get();
          if (followUpDoc.exists) {
            const followUp = followUpDoc.data();
            if (followUp?.scheduledAt) {
              const scheduledTime = new Date(followUp.scheduledAt).getTime();
              const diffMs = now.getTime() - scheduledTime;
              if (diffMs > 0) {
                // Follow up is overdue
                const hoursOverdue = diffMs / (1000 * 60 * 60);
                factors.timeSensitivity = Math.min(10, 8 + Math.floor(hoursOverdue / 24));
              } else {
                factors.timeSensitivity = 5;
              }
            }
          }
        }

        // Calculate final weighted score
        const weightedScore = Math.min(
          100,
          Math.max(
            0,
            baseScore +
              (factors.goalAlignment - 5) * 1.5 +
              (factors.relationshipStrength - 5) * 1.5 +
              (factors.timeSensitivity - 5) * 2
          )
        );

        // Map score to priority band
        let priority = OpportunityPriority.LOW;
        if (weightedScore >= 85) {
          priority = OpportunityPriority.HIGH;
        } else if (weightedScore >= 65) {
          priority = OpportunityPriority.MEDIUM;
        }

        // Update database if score changed
        if (opp.priorityScore !== weightedScore || opp.priority !== priority) {
          await db.collection("opportunities").doc(opp.id).update({
            priorityScore: Math.round(weightedScore),
            priority,
            updatedAt: now.toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn("PrioritizationAgent: Recalculate scores failed:", err);
    }
  }
}
export default PrioritizationAgent;
