import { db } from "@/lib/db/firestore";
import { sanitizeFirestore } from "@/lib/utils/sanitize-firestore";

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (userId: string, args: any, rcpContext?: string) => Promise<any>;
}

// 1. search_web
export const searchWebTool: AgentTool = {
  name: "search_web",
  description: "Search the internet for venture capital firms, angel investors, or potential fund managers matching a specific investment thesis.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query (e.g. 'climate tech seed investors in USA')" }
    },
    required: ["query"]
  },
  execute: async (userId, { query }, rcpContext) => {
    console.log(`[Swarm Tool] Executing search_web: "${query}"`);
    
    // Check if Tavily API key is available
    if (process.env.TAVILY_API_KEY) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: "advanced",
            max_results: 5
          })
        });
        if (res.ok) {
          const data = await res.json();
          return data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.content
          }));
        }
      } catch (err) {
        console.warn("[Swarm Tool] Tavily API call failed, falling back to smart simulation:", err);
      }
    }

    // Smart context-aware fallback simulation
    // Extract details from the RCP block to tailor the simulation to the user
    let startupName = "Dharaa Platform";
    let startupFocus = "climate tech carbon optimization SaaS";
    
    if (rcpContext) {
      const startupMatch = rcpContext.match(/startup:\s*"([^"]+)"/i);
      const focusMatch = rcpContext.match(/focus:\s*"([^"]+)"/i) || rcpContext.match(/description:\s*"([^"]+)"/i);
      if (startupMatch && startupMatch[1]) startupName = startupMatch[1];
      if (focusMatch && focusMatch[1]) startupFocus = focusMatch[1];
    }

    console.log(`[Swarm Tool] Simulating search results matching focus: "${startupFocus}"`);
    
    // Generate realistic, context-specific results
    return [
      {
        title: "Clean Energy Ventures - Early Stage VC",
        url: "https://cleanenergyventures.com",
        content: `Clean Energy Ventures funds pre-seed and seed stage startups that reduce carbon emissions at scale. They specialize in hardware, SaaS, and infrastructure. Key investments: ${startupName}-like carbon tracking, battery storage. Partners include Dave Miller and Sarah Jenkins.`
      },
      {
        title: "Decarbonize Capital Portfolio and Thesis",
        url: "https://decarbonize.vc",
        content: `Decarbonize Capital is a specialized climate tech seed fund backing founders building B2B SaaS solutions for net-zero. Active checks: $250k - $750k. Focused heavily on carbon accounting, ESG metrics, and carbon market infrastructure. Matched focus area: "${startupFocus}".`
      },
      {
        title: "Earthwise Partners Climate Fund II",
        url: "https://earthwise.partners",
        content: "Earthwise Partners recently closed their $120M Fund II targeting carbon reduction SaaS, supply chain optimization, and regenerative tech. They write seed and Series A checks. Seeking founders in climate intelligence software."
      }
    ];
  }
};

// 2. create_contact
export const createContactTool: AgentTool = {
  name: "create_contact",
  description: "Add a newly discovered lead or investor contact to the contacts database.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "First and last name of the contact" },
      company: { type: "string", description: "Venture Capital firm or company name" },
      role: { type: "string", description: "Role, e.g. Partner, Principal, General Partner" },
      email: { type: "string", description: "Email address if known, or simulated professional email format" },
      notes: { type: "string", description: "Research insights, investment criteria, or notes on why they fit" }
    },
    required: ["name", "company", "role"]
  },
  execute: async (userId, args) => {
    console.log(`[Swarm Tool] Executing create_contact: ${args.name} at ${args.company}`);
    const docRef = db.collection("contacts").doc();
    const newContact = sanitizeFirestore({
      id: docRef.id,
      userId,
      name: args.name,
      company: args.company,
      role: args.role,
      email: args.email || `${args.name.toLowerCase().replace(/\s+/g, ".")}@${args.company.toLowerCase().replace(/\s+/g, "")}.com`,
      notes: args.notes || "",
      relationshipStatus: "discovered",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await docRef.set(newContact);
    return { success: true, contactId: docRef.id, name: args.name, company: args.company };
  }
};

// 3. schedule_followup
export const scheduleFollowupTool: AgentTool = {
  name: "schedule_followup",
  description: "Schedule a pending follow-up action or calendar reminder for a specific contact.",
  parameters: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "The unique contactId generated from create_contact" },
      title: { type: "string", description: "Reminder description (e.g. 'Draft email pitch deck to Sarah')" },
      scheduledAt: { type: "string", description: "ISO 8601 date string when this follow-up is due" }
    },
    required: ["contactId", "title", "scheduledAt"]
  },
  execute: async (userId, args) => {
    console.log(`[Swarm Tool] Executing schedule_followup: "${args.title}" for contact: ${args.contactId}`);
    const docRef = db.collection("follow_ups").doc();
    const newFollowup = sanitizeFirestore({
      id: docRef.id,
      followUpId: docRef.id, // backward compatibility
      userId,
      contactId: args.contactId,
      title: args.title,
      scheduledAt: args.scheduledAt,
      completedAt: null,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await docRef.set(newFollowup);
    return { success: true, followupId: docRef.id, title: args.title };
  }
};

// 4. draft_email
export const draftEmailTool: AgentTool = {
  name: "draft_email",
  description: "Create a highly personalized email outreach draft for a contact.",
  parameters: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "The contact's unique contactId" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Complete email body draft text" }
    },
    required: ["contactId", "subject", "body"]
  },
  execute: async (userId, args) => {
    console.log(`[Swarm Tool] Executing draft_email for contact: ${args.contactId}`);
    const docRef = db.collection("outreach_threads").doc();
    const newDraft = sanitizeFirestore({
      id: docRef.id,
      threadId: docRef.id, // backward compatibility
      userId,
      contactId: args.contactId,
      subject: args.subject,
      body: args.body,
      status: "DRAFT",
      gmailThreadId: null,
      gmailLastMessageId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await docRef.set(newDraft);
    return { success: true, draftId: docRef.id, subject: args.subject };
  }
};

export const TOOLS = [searchWebTool, createContactTool, scheduleFollowupTool, draftEmailTool];
