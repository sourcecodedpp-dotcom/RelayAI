/**
 * Context Assembler — The 7-Step Mission Context Pipeline
 *
 * Executes the following pipeline for every AI request:
 * 1. Receive user command
 * 2. Identify active mission
 * 3. Retrieve relevant memory objects from Firestore
 * 4. Rank context by relevance
 * 5. Compress context to fit model limits
 * 6. Generate structured context package
 * 7. Return package for agent execution
 *
 * Context assembly occurs entirely server-side.
 * The frontend never manages context windows.
 */

import { db } from "@/lib/db/firestore";
import { MemoryService } from "./memory";
import type {
  ContextSource,
  MissionContextPackage,
  RelevanceWeights,
  Mission,
} from "./types";
import {
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_RELEVANCE_WEIGHTS,
} from "./types";

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Approximate token count from text (standard ~4 chars per token). */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

/**
 * Computes keyword overlap score between command and content.
 * Returns 0–30 based on how many command words appear in the content.
 */
function scoreKeywordOverlap(
  command: string,
  content: string,
  maxScore: number
): number {
  if (!command || !content) return 0;

  const commandWords = command
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2); // ignore very short words
  if (commandWords.length === 0) return 0;

  const contentLower = content.toLowerCase();
  let matches = 0;

  for (const word of commandWords) {
    if (contentLower.includes(word)) {
      matches++;
    }
  }

  return Math.round((matches / commandWords.length) * maxScore);
}

/**
 * Computes recency score using exponential decay.
 * Items < 1 hour → maxScore, < 24h → ~20, < 7d → ~10, older → ~2.
 */
function scoreRecency(
  dateStr: string | undefined,
  maxScore: number
): number {
  if (!dateStr) return Math.round(maxScore * 0.1); // no date → low score

  const ageMs = Date.now() - new Date(dateStr).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 1) return maxScore;
  if (ageHours < 6) return Math.round(maxScore * 0.85);
  if (ageHours < 24) return Math.round(maxScore * 0.65);
  if (ageHours < 72) return Math.round(maxScore * 0.4);
  if (ageHours < 168) return Math.round(maxScore * 0.2); // 7 days
  return Math.round(maxScore * 0.07);
}

/**
 * Maps relationship status to a score.
 */
function scoreRelationship(
  status: string | undefined,
  maxScore: number
): number {
  const mapping: Record<string, number> = {
    WARM: 1.0,
    RESPONDED: 0.75,
    CONTACTED: 0.5,
    DISCOVERED: 0.25,
    COLD: 0.1,
  };
  return Math.round((mapping[status || ""] || 0.1) * maxScore);
}

/**
 * Scores mission alignment — does the item's goal match the mission's goals?
 */
function scoreMissionAlignment(
  itemGoalId: string | null,
  missionGoalIds: string[],
  maxScore: number
): number {
  if (!itemGoalId || missionGoalIds.length === 0) {
    return Math.round(maxScore * 0.25); // no alignment info → neutral
  }
  return missionGoalIds.includes(itemGoalId) ? maxScore : Math.round(maxScore * 0.1);
}

// ---------------------------------------------------------------------------
// Context Assembler
// ---------------------------------------------------------------------------

export class ContextAssembler {
  /**
   * The main pipeline. Assembles a ranked, compressed context package
   * from all memory sources for a single AI request.
   */
  static async assembleContext(
    userId: string,
    command: string,
    passedMissionId: string | null = null,
    tokenBudget: number = DEFAULT_TOKEN_BUDGET,
    weights: RelevanceWeights = DEFAULT_RELEVANCE_WEIGHTS
  ): Promise<MissionContextPackage> {
    console.log("[ContextAssembler] Step 1: Command received");

    // ------ Step 2: Identify active mission ------
    console.log("[ContextAssembler] Step 2: Identifying active mission");
    let mission: any = null;
    let resolvedMissionId = passedMissionId;

    if (resolvedMissionId) {
      const missionDoc = await db.collection("missions").doc(resolvedMissionId).get();
      if (missionDoc.exists) {
        mission = { missionId: missionDoc.id, id: missionDoc.id, ...missionDoc.data() };
      }
    }

    if (!mission) {
      mission = await MemoryService.getActiveMission(userId);
      resolvedMissionId = mission?.missionId || (mission as any)?.id || null;
    }

    const missionGoalIds = (mission as any)?.goalIds || [];

    console.log(
      `[ContextAssembler] Mission: ${mission ? mission.title : "None"}`
    );

    // Retrieve and prioritize mission events
    let recentEvents: any[] = [];
    if (resolvedMissionId) {
      try {
        const eventsSnap = await db.collection("mission_events")
          .where("missionId", "==", resolvedMissionId)
          .where("userId", "==", userId)
          .get();
        recentEvents = eventsSnap.docs.map((doc) => ({
          eventId: doc.id,
          ...doc.data(),
        }));
      } catch (err) {
        console.warn("[ContextAssembler] Failed to retrieve mission events:", err);
      }
    }

    const eventWeights: Record<string, number> = {
      ai_output: 5,
      command: 4,
      opportunity: 3,
      gmail_thread: 2,
      contact: 1,
      follow_up: 1,
    };

    const scoredEvents = recentEvents.map((evt) => {
      const baseWeight = eventWeights[evt.type] || 1;
      const score = baseWeight + (evt.sequenceNumber || 0) * 0.001;
      return { ...evt, score };
    });

    scoredEvents.sort((a, b) => b.score - a.score);
    const top20Events = scoredEvents.slice(0, 20);
    top20Events.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    const formattedEvents = top20Events.map((e) => {
      const dateStr = e.createdAt ? new Date(e.createdAt).toISOString().replace("T", " ").substring(0, 19) : "unknown";
      return `[${dateStr}] [Event: ${e.type}] ${e.content}`;
    });

    // ------ Step 3: Retrieve memory objects (parallel fetch) ------
    console.log("[ContextAssembler] Step 3: Retrieving memory objects");

    const [
      userProfile,
      goals,
      contacts,
      companies,
      opportunities,
      recentCommands,
      followUps,
      userPreferences,
    ] = await Promise.all([
      MemoryService.getUserProfile(userId),
      MemoryService.getGoals(userId, resolvedMissionId),
      MemoryService.getRelevantContacts(userId, resolvedMissionId),
      MemoryService.getRelevantCompanies(userId, resolvedMissionId),
      MemoryService.getRecentOpportunities(userId),
      MemoryService.getRecentCommands(userId),
      MemoryService.getFollowUpHistory(userId, resolvedMissionId),
      MemoryService.getUserPreferences(userId),
    ]);

    // Fetch Gmail context + research for retrieved contacts
    const contactIds = contacts.map((c) => c.id);
    const [gmailContext, researchInsights] = await Promise.all([
      MemoryService.getGmailContext(userId, contactIds),
      MemoryService.getResearchInsights(userId, contactIds),
    ]);

    // ------ Step 4: Rank context by relevance ------
    console.log("[ContextAssembler] Step 4: Ranking context by relevance");

    const sources: ContextSource[] = [];

    // User profile — always high relevance
    sources.push({
      type: "user_profile",
      label: "User Profile",
      content: userProfile,
      relevanceScore: 95,
      tokenEstimate: estimateTokens(userProfile),
    });

    // Mission — always high relevance if active
    if (mission) {
      const missionStr = `Mission: ${mission.title}. ${mission.description}`;
      sources.push({
        type: "mission",
        label: "Active Mission",
        content: missionStr,
        relevanceScore: 95,
        tokenEstimate: estimateTokens(missionStr),
      });
    }

    // Goals
    for (const goal of goals) {
      const goalStr = `Goal: ${goal.title}. ${goal.description}`;
      const score =
        scoreKeywordOverlap(command, goalStr, weights.keywordOverlap) +
        scoreMissionAlignment(goal.id, missionGoalIds, weights.missionAlignment) +
        20; // base relevance for goals
      sources.push({
        type: "goal",
        label: `Goal: ${goal.title}`,
        content: goalStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(goalStr),
      });
    }

    // User preferences — always included
    sources.push({
      type: "preference",
      label: "User Preferences",
      content: userPreferences,
      relevanceScore: 85,
      tokenEstimate: estimateTokens(userPreferences),
    });

    // Contacts
    for (const contact of contacts) {
      const contactStr = `${contact.name} — ${contact.role} at ${contact.company}. Status: ${contact.relationshipStatus}. Notes: ${contact.notes}`;
      const score =
        scoreKeywordOverlap(command, contactStr, weights.keywordOverlap) +
        scoreRelationship(contact.relationshipStatus, weights.relationshipStrength) +
        scoreMissionAlignment(contact.goalId, missionGoalIds, weights.missionAlignment);
      sources.push({
        type: "contact",
        label: `Contact: ${contact.name}`,
        content: contactStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(contactStr),
      });
    }

    // Companies
    for (const company of companies) {
      const companyStr = `${company.name}: ${company.info || "No details"}. Contacts: ${company.contactNames.join(", ")}`;
      const score =
        scoreKeywordOverlap(command, companyStr, weights.keywordOverlap) + 15;
      sources.push({
        type: "company",
        label: `Company: ${company.name}`,
        content: companyStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(companyStr),
      });
    }

    // Recent commands — behavioral continuity
    for (const cmd of recentCommands) {
      const cmdStr = `[${cmd.createdAt}] "${cmd.command}" → ${cmd.intent} (${cmd.outcomeType})`;
      const score = scoreRecency(cmd.createdAt, weights.recency) + 10;
      sources.push({
        type: "command_history",
        label: "Recent Command",
        content: cmdStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(cmdStr),
      });
    }

    // Gmail threads
    for (const thread of gmailContext) {
      const threadStr = `Thread: "${thread.subject}" [${thread.status}]`;
      const score =
        scoreKeywordOverlap(command, threadStr, weights.keywordOverlap) +
        scoreRecency(thread.updatedAt, weights.recency);
      sources.push({
        type: "gmail",
        label: `Email: ${thread.subject}`,
        content: threadStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(threadStr),
      });
    }

    // Opportunities
    for (const opp of opportunities) {
      const oppStr = `${opp.type}: ${opp.title} [${opp.priority}, score: ${opp.score}] — ${opp.description}`;
      const score =
        scoreKeywordOverlap(command, oppStr, weights.keywordOverlap) +
        Math.min(opp.score * 0.3, 25) + // higher-scored opps get more relevance
        10;
      sources.push({
        type: "opportunity",
        label: `Opportunity: ${opp.title}`,
        content: oppStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(oppStr),
      });
    }

    // Follow-ups
    for (const fu of followUps) {
      const fuStr = `Follow-up: "${fu.title}" [${fu.status}] scheduled ${fu.scheduledAt}`;
      const score =
        scoreKeywordOverlap(command, fuStr, weights.keywordOverlap) +
        scoreRecency(fu.scheduledAt, weights.recency) +
        (fu.status === "PENDING" ? 15 : 5);
      sources.push({
        type: "follow_up",
        label: `Follow-up: ${fu.title}`,
        content: fuStr,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(fuStr),
      });
    }

    // Research insights
    for (const insight of researchInsights) {
      const parts = [insight.whyRelevant, insight.keyInsights, insight.recentNews]
        .filter(Boolean)
        .join(". ");
      if (!parts) continue;
      const score = scoreKeywordOverlap(command, parts, weights.keywordOverlap) + 15;
      sources.push({
        type: "research",
        label: `Research: ${insight.contactId}`,
        content: parts,
        relevanceScore: Math.min(score, 100),
        tokenEstimate: estimateTokens(parts),
      });
    }

    // ------ Step 5: Compress context to fit model limits ------
    console.log("[ContextAssembler] Step 5: Compressing to token budget");

    // Sort all sources by relevance (highest first)
    sources.sort((a, b) => b.relevanceScore - a.relevanceScore);

    let usedTokens = 0;
    let truncated = false;
    const includedSources: ContextSource[] = [];

    for (const source of sources) {
      if (usedTokens + source.tokenEstimate > tokenBudget) {
        truncated = true;
        // Try to include a truncated version for high-relevance sources
        if (source.relevanceScore >= 70) {
          const remainingBudget = tokenBudget - usedTokens;
          if (remainingBudget > 20) {
            const truncatedContent = source.content.substring(
              0,
              remainingBudget * 4
            );
            includedSources.push({
              ...source,
              content: truncatedContent + "…",
              tokenEstimate: remainingBudget,
            });
            usedTokens += remainingBudget;
          }
        }
        continue;
      }
      includedSources.push(source);
      usedTokens += source.tokenEstimate;
    }

    // ------ Step 6: Generate structured context package ------
    console.log("[ContextAssembler] Step 6: Generating context package");

    const pkg: MissionContextPackage = {
      mission: mission
        ? { 
            title: mission.title, 
            description: mission.summary || mission.description || "",
            summary: mission.summary || "",
            currentSummary: mission.currentSummary || ""
          }
        : null,
      recentEvents: formattedEvents,
      userProfile: this.extractByType(includedSources, "user_profile"),
      goals: this.extractAllByType(includedSources, "goal"),
      relevantContacts: this.extractAllByType(includedSources, "contact"),
      relevantCompanies: this.extractAllByType(includedSources, "company"),
      recentCommands: this.extractAllByType(includedSources, "command_history"),
      gmailContext: this.extractAllByType(includedSources, "gmail"),
      opportunities: this.extractAllByType(includedSources, "opportunity"),
      followUpHistory: this.extractAllByType(includedSources, "follow_up"),
      researchInsights: this.extractAllByType(includedSources, "research"),
      userPreferences: this.extractByType(includedSources, "preference"),
      totalTokens: usedTokens,
      truncated,
    };

    console.log(
      `[ContextAssembler] Step 7: Package ready (${usedTokens} tokens, ${includedSources.length} sources, truncated: ${truncated})`
    );

    return pkg;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Extract the first source of a given type as a string. */
  private static extractByType(
    sources: ContextSource[],
    type: ContextSource["type"]
  ): string {
    const source = sources.find((s) => s.type === type);
    return source?.content || "";
  }

  /** Extract all sources of a given type as string array. */
  private static extractAllByType(
    sources: ContextSource[],
    type: ContextSource["type"]
  ): string[] {
    return sources.filter((s) => s.type === type).map((s) => s.content);
  }

  /**
   * Serializes the context package into a system prompt section.
   * This is injected into the AI system instruction.
   */
  static formatForPrompt(pkg: MissionContextPackage): string {
    const sections: string[] = [];

    sections.push("=== MISSION CONTEXT ===");

    if (pkg.mission) {
      const parts = [
        `Title: ${pkg.mission.title}`,
        pkg.mission.summary ? `Summary: ${pkg.mission.summary}` : null,
        pkg.mission.currentSummary ? `Current workspace summary: ${pkg.mission.currentSummary}` : null,
        pkg.mission.description ? `Description: ${pkg.mission.description}` : null
      ].filter(Boolean);
      sections.push(`\n## Active Mission\n${parts.join("\n")}`);
    }

    if (pkg.recentEvents && pkg.recentEvents.length > 0) {
      sections.push(`\n## Recent Workspace Events\n${pkg.recentEvents.map((e) => `- ${e}`).join("\n")}`);
    }

    if (pkg.userProfile) {
      sections.push(`\n## User Profile\n${pkg.userProfile}`);
    }

    if (pkg.userPreferences) {
      sections.push(`\n## User Preferences\n${pkg.userPreferences}`);
    }

    if (pkg.goals.length > 0) {
      sections.push(`\n## Active Goals\n${pkg.goals.map((g) => `- ${g}`).join("\n")}`);
    }

    if (pkg.relevantContacts.length > 0) {
      sections.push(
        `\n## Key Contacts\n${pkg.relevantContacts.map((c) => `- ${c}`).join("\n")}`
      );
    }

    if (pkg.relevantCompanies.length > 0) {
      sections.push(
        `\n## Companies\n${pkg.relevantCompanies.map((c) => `- ${c}`).join("\n")}`
      );
    }

    if (pkg.opportunities.length > 0) {
      sections.push(
        `\n## Pending Opportunities\n${pkg.opportunities.map((o) => `- ${o}`).join("\n")}`
      );
    }

    if (pkg.followUpHistory.length > 0) {
      sections.push(
        `\n## Follow-up Actions\n${pkg.followUpHistory.map((f) => `- ${f}`).join("\n")}`
      );
    }

    if (pkg.gmailContext.length > 0) {
      sections.push(
        `\n## Recent Email Activity\n${pkg.gmailContext.map((g) => `- ${g}`).join("\n")}`
      );
    }

    if (pkg.researchInsights.length > 0) {
      sections.push(
        `\n## Research Insights\n${pkg.researchInsights.map((r) => `- ${r}`).join("\n")}`
      );
    }

    if (pkg.recentCommands.length > 0) {
      sections.push(
        `\n## Recent Commands\n${pkg.recentCommands.map((c) => `- ${c}`).join("\n")}`
      );
    }

    sections.push("\n=== END MISSION CONTEXT ===");

    return sections.join("\n");
  }
}

export default ContextAssembler;
