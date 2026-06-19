import { PrioritizationAgent } from "@/lib/ai/agents/prioritization-agent";
import { OpportunityEngine } from "@/lib/ai/orchestration/opportunity-engine";

/**
 * Backwards compatible delegate to the new PrioritizationAgent
 */
export async function recalculateOpportunityScores(userId: string) {
  return await PrioritizationAgent.recalculateScores(userId);
}

/**
 * Backwards compatible delegate to the new OpportunityEngine
 */
export async function handleInvestorReply(
  userId: string,
  contactId: string,
  threadId: string,
  contactName: string,
  company: string
) {
  return await OpportunityEngine.handleInvestorReply(userId, contactId, threadId, contactName, company);
}

/**
 * Backwards compatible delegate to the new OpportunityEngine
 */
export async function triggerFollowUpDueOpportunity(
  userId: string,
  contactId: string,
  followUpId: string,
  contactName: string,
  followUpTitle: string
) {
  return await OpportunityEngine.triggerFollowUpDueOpportunity(userId, contactId, followUpId, contactName, followUpTitle);
}

/**
 * Backwards compatible delegate to the new OpportunityEngine
 */
export async function triggerNewContactOpportunity(
  userId: string,
  contactId: string,
  contactName: string,
  company: string,
  role: string
) {
  return await OpportunityEngine.triggerNewContactOpportunity(userId, contactId, contactName, company, role);
}
