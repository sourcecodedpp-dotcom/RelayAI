import { db } from "@/lib/db/firestore";
import { GlobalRCP, ConversationRCP } from "./types";
import { validateGlobalRCP, DEFAULT_GLOBAL_RCP } from "./schemas/global";
import { validateConversationRCP, DEFAULT_CONVERSATION_RCP } from "./schemas/conversation";

interface CacheEntry {
  content: string;
  generatedAt: number;
}

const rcpCache: Record<string, CacheEntry> = {};
const rcpCacheHitStatus: Record<string, boolean> = {};

export function getCacheHitStatus(userId: string, conversationId: string): boolean {
  const cacheKey = `${userId}:${conversationId}`;
  return !!rcpCacheHitStatus[cacheKey];
}

export function invalidateRCPCache(userId: string, conversationId?: string) {
  if (conversationId) {
    const cacheKey = `${userId}:${conversationId}`;
    delete rcpCache[cacheKey];
    delete rcpCacheHitStatus[cacheKey];
    console.log(`[RCP Cache] Invalidated cache for key ${cacheKey}`);
  } else {
    for (const key of Object.keys(rcpCache)) {
      if (key.startsWith(`${userId}:`)) {
        delete rcpCache[key];
        delete rcpCacheHitStatus[key];
        console.log(`[RCP Cache] Invalidated cache for key ${key}`);
      }
    }
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Builds the compiled RCP string for a conversation (Read-Only).
 * Scopes to token limits, priorities, and caches results.
 */
export async function buildRCP(
  userId: string,
  conversationId: string,
  maxContextTokens: number = 80000,
  maxContextTokensOverride?: number
): Promise<string> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const cacheKey = `${userId}:${conversationId}`;
  const startMs = Date.now();

  // 1. Check cache (30-second cache time to optimize latency/costs)
  const cached = rcpCache[cacheKey];
  if (cached && nowMs - cached.generatedAt < 30000) {
    rcpCacheHitStatus[cacheKey] = true;
    const durationMs = Date.now() - startMs;
    const tokenCount = estimateTokens(cached.content);
    console.log(`[RCP Diagnostics] userId=${userId} conversationId=${conversationId} cache=HIT tokenCount=${tokenCount} durationMs=${durationMs}`);
    return cached.content;
  }

  rcpCacheHitStatus[cacheKey] = false;

  // 2. Fetch context documents from Firestore (Read-Only)
  const globalRef = db.collection("users").doc(userId).collection("context").doc("global");
  const convRef = db
    .collection("users")
    .doc(userId)
    .collection("conversations")
    .doc(conversationId)
    .collection("context")
    .doc("rcp");

  let globalData: GlobalRCP = { ...DEFAULT_GLOBAL_RCP };
  try {
    const globalDoc = await globalRef.get();
    if (globalDoc.exists) {
      globalData = validateGlobalRCP(globalDoc.data());
    } else {
      console.log(`[RCP Compiler] Global context missing for user ${userId}. Fetching database fallback...`);
      globalData = await compileGlobalFallback(userId);
    }
  } catch (err) {
    console.warn("[RCP Compiler] Failed to load Global RCP:", err);
  }

  let convData: ConversationRCP = DEFAULT_CONVERSATION_RCP(conversationId);
  try {
    const convDoc = await convRef.get();
    if (convDoc.exists) {
      convData = validateConversationRCP(convDoc.data(), conversationId);
    } else {
      console.log(`[RCP Compiler] Conversation context missing for ${conversationId}. Fetching database fallback...`);
      convData = await compileConversationFallback(userId, conversationId);
    }
  } catch (err) {
    console.warn("[RCP Compiler] Failed to load Conversation RCP:", err);
  }

  // 3. Enforce token limits
  const tokenBudget = Math.min(
    maxContextTokens * 0.4,
    maxContextTokensOverride ?? Infinity
  );

  // 4. Compile sections to format-ready blocks
  const sections = [
    {
      name: "CONVERSATION",
      priority: 1, // Highest
      content: compileConversationBlock(convData),
    },
    {
      name: "PROFILE",
      priority: 2,
      content: compileProfileBlock(globalData.profile),
    },
    {
      name: "GMAIL",
      priority: 3,
      content: compileGmailBlock(globalData.gmail),
    },
    {
      name: "FOLLOWUPS",
      priority: 4,
      content: compileFollowUpsBlock(globalData.followUps),
    },
    {
      name: "OPPORTUNITIES",
      priority: 5,
      content: compileOpportunitiesBlock(globalData.opportunities),
    },
    {
      name: "CONTACTS",
      priority: 6, // Lowest
      content: compileContactsBlock(globalData.contacts),
    },
  ];

  // 5. Generate metadata header
  const metadataBlock = `META {\n  generated_at: "${now}"\n  conversation: "${conversationId}"\n  token_budget: ${Math.floor(tokenBudget)}\n}`;
  
  let currentTokens = estimateTokens(`RCP/1.0\n\n${metadataBlock}\n\n`);
  const compiledSections: string[] = [];

  // 6. Apply priorities under token budget
  for (const sec of sections) {
    const secTokens = estimateTokens(sec.content + "\n\n");
    if (currentTokens + secTokens <= tokenBudget) {
      compiledSections.push(sec.content);
      currentTokens += secTokens;
    } else {
      console.log(`[RCP Compiler] Omitted lower priority section "${sec.name}" due to token budget constraint.`);
    }
  }

  const finalRCP = `RCP/1.0\n\n${metadataBlock}\n\n${compiledSections.join("\n\n")}`;
  const durationMs = Date.now() - startMs;
  const tokenCount = estimateTokens(finalRCP);
  const includedSections = sections
    .filter(s => compiledSections.includes(s.content))
    .map(s => s.name);

  console.log(`[RCP Diagnostics] userId=${userId} conversationId=${conversationId} cache=MISS includedSections=${JSON.stringify(includedSections)} tokenCount=${tokenCount} durationMs=${durationMs}`);

  // 7. Write to cache
  rcpCache[cacheKey] = {
    content: finalRCP,
    generatedAt: nowMs,
  };

  return finalRCP;
}

function compileProfileBlock(profile: any): string {
  const startup = profile.startup ? `  startup: "${profile.startup}"` : "";
  const focus = profile.description ? `  focus: "${profile.description}"` : "";
  const target = profile.targetAudience && profile.targetAudience.length > 0
    ? `  target: ${JSON.stringify(profile.targetAudience)}`
    : "";

  const lines = [startup, focus, target].filter(Boolean);
  return `PROFILE {\n${lines.join("\n")}\n}`;
}

function compileGmailBlock(gmail: any): string {
  const lines = [
    `  unread: ${gmail.unreadCount || 0}`,
    `  followups_due: ${gmail.followUpsDue || 0}`,
  ];
  if (gmail.lastOutreach) {
    lines.push(`  last_outreach: "${gmail.lastOutreach}"`);
  }
  return `GMAIL {\n${lines.join("\n")}\n}`;
}

function compileContactsBlock(contacts: any): string {
  const prospects = contacts.topProspects || [];
  const statusMap = contacts.status || {};
  
  const lines = prospects.map((p: string) => {
    const contactKey = p.replace(/\./g, "_");
    const status = statusMap[contactKey] || "discovered";
    return `  "${p}" status=${status}`;
  });

  return `CONTACTS priority=high {\n${lines.join("\n")}\n}`;
}

function compileConversationBlock(conv: ConversationRCP): string {
  const lines = [];
  if (conv.goal) lines.push(`  goal: "${conv.goal}"`);
  if (conv.summary) lines.push(`  summary: "${conv.summary}"`);
  if (conv.entities && conv.entities.length > 0) {
    lines.push(`  entities: ${JSON.stringify(conv.entities)}`);
  }
  if (conv.recentActions && conv.recentActions.length > 0) {
    lines.push(`  recent_actions: ${JSON.stringify(conv.recentActions)}`);
  }
  
  const header = conv.goal ? "CONVERSATION active" : "CONVERSATION";
  return `${header} {\n${lines.join("\n")}\n}`;
}

function compileOpportunitiesBlock(opps: any): string {
  return `OPPORTUNITIES {\n  active: ${opps.active || 0}\n}`;
}

function compileFollowUpsBlock(followUps: any): string {
  const pending = followUps?.pending || [];
  const lines = pending.map((f: string) => `  - "${f}"`);
  return `FOLLOWUPS {\n${lines.join("\n")}\n}`;
}

async function compileGlobalFallback(userId: string): Promise<GlobalRCP> {
  const now = new Date().toISOString();
  
  let profile = {};
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    profile = {
      startup: userData.primaryUseCase || "",
      description: userData.outreachGoals || "",
      targetAudience: [],
    };
  } catch (e) {
    console.warn("Global fallback: profile error:", e);
  }

  let topProspects: string[] = [];
  const statusMap: Record<string, string> = {};
  try {
    const contactsSnap = await db.collection("contacts").where("userId", "==", userId).get();
    contactsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.name) {
        topProspects.push(data.name);
        const contactKey = (doc.id || data.name).replace(/\./g, "_");
        statusMap[contactKey] = data.relationshipStatus || "discovered";
      }
    });
  } catch (e) {
    console.warn("Global fallback: contacts error:", e);
  }

  let activeOpps = 0;
  try {
    const oppsSnap = await db.collection("opportunities")
      .where("userId", "==", userId)
      .where("status", "==", "PENDING")
      .get();
    activeOpps = oppsSnap.size;
  } catch (e) {
    console.warn("Global fallback: opportunities error:", e);
  }

  let followUpsDue = 0;
  const pendingFollowUps: string[] = [];
  try {
    const followUpsSnap = await db.collection("follow_ups")
      .where("userId", "==", userId)
      .where("status", "==", "PENDING")
      .get();
    
    followUpsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.title) {
        pendingFollowUps.push(data.title);
      }
    });
    followUpsDue = followUpsSnap.size;
  } catch (e) {
    console.warn("Global fallback: followups error:", e);
  }

  return {
    version: "1.0",
    updatedAt: now,
    profile,
    gmail: {
      unreadCount: 0,
      followUpsDue,
    },
    contacts: {
      topProspects: topProspects.slice(0, 10),
      status: statusMap,
    },
    opportunities: {
      active: activeOpps,
    },
    followUps: {
      pending: pendingFollowUps,
    },
  };
}

async function compileConversationFallback(userId: string, conversationId: string): Promise<ConversationRCP> {
  const now = new Date().toISOString();
  let goal = "";
  let summary = "";
  let entities: string[] = [];
  let recentActions: string[] = [];

  try {
    const memDoc = await db.collection("conversation_memory").doc(conversationId).get();
    if (memDoc.exists) {
      const memData = memDoc.data() || {};
      summary = memData.summary || "";
      entities = [
        ...(memData.contacts || []),
        ...(memData.companies || []),
        ...(memData.entities || []),
      ];
      if (memData.goals && memData.goals.length > 0) {
        goal = memData.goals[0];
      }
    }
  } catch (e) {
    console.warn("Conversation fallback: memory error:", e);
  }

  try {
    const messagesSnap = await db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .orderBy("sequenceNumber", "desc")
      .limit(5)
      .get();
    
    const msgs = messagesSnap.docs.map(doc => doc.data());
    msgs.reverse();
    recentActions = msgs.map((m: any) => {
      const role = m.role === "user" ? "User prompt" : "AI response";
      return `${role} at ${m.createdAt || now}`;
    });
  } catch (e) {
    console.warn("Conversation fallback: actions error:", e);
  }

  return {
    version: "1.0",
    conversationId,
    updatedAt: now,
    goal: goal || undefined,
    summary: summary || undefined,
    entities: entities.slice(0, 20),
    recentActions: recentActions.slice(0, 10),
  };
}
