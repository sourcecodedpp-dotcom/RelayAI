import { User, Goal, Person, BriefingItem } from './types';

export interface AppState {
  user: User;
  goals: Goal[];
  people: Person[];
  briefingItems: BriefingItem[];
}

export const DATA: AppState = {
  user: {
    name: "Alex Mercer",
    company: "Aether Dynamics",
    avatar: "AM"
  },
  goals: [
    {
      id: "goal_funding",
      name: "Raise Seed Round",
      desc: "Secure $1.5M funding for Aether Dynamics seed round.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      progress: 53,
      metrics: {
        reached: 12,
        responses: 8,
        meetings: 4,
        target: 15
      },
      recommendedActions: [
        "Reach out to Priya Sharma — Sequoia just announced a new AI fund.",
        "Follow up with Sarah Chen — she read the pitch deck 2 days ago.",
        "Update the seed pitch deck based on feedback from David Park."
      ]
    },
    {
      id: "goal_cofounder",
      name: "Find Technical Co-founder",
      desc: "Partner with a world-class AI/ML engineer to lead systems architecture.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      progress: 25,
      metrics: {
        reached: 6,
        responses: 3,
        meetings: 1,
        target: 10
      },
      recommendedActions: [
        "Ping Marcus Vance about his recent research on distributed LLM systems.",
        "Check mutual connections with Elena Rostova for an introduction."
      ]
    },
    {
      id: "goal_pilots",
      name: "Secure 5 Pilot Customers",
      desc: "Close contracts with early adopters in enterprise software.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      progress: 60,
      metrics: {
        reached: 10,
        responses: 6,
        meetings: 3,
        target: 5
      },
      recommendedActions: [
        "Send pilot proposal to James Wu at TechFlow Solutions.",
        "Schedule a demo session with Clara Jenkins."
      ]
    }
  ],
  people: [
    {
      id: "person_sarah",
      name: "Sarah Chen",
      role: "General Partner",
      company: "Apex Ventures",
      avatar: "SC",
      status: "active",
      relevance: 96,
      relevanceReason: "Focuses on seed-stage cognitive systems and developer tooling. Pre-seed lead investor in LangChain.",
      whyMatter: "Sarah is highly active in the AI-native developer tooling space. She holds board seats at three related portfolio companies and is currently looking for an early infrastructure layer investment.",
      goalId: "goal_funding",
      tags: ["Developer Tooling", "AI Agents", "Seed Stage", "San Francisco"],
      insights: [
        "Recently tweeted: 'Looking for teams reimagining development environments from the LLM-first perspective.'",
        "Prefers short, technical loom demos over traditional slide decks.",
        "Co-invests frequently with Founder Collective and Spark Capital."
      ],
      timeline: [
        { type: "received", label: "Replied: 'Looks interesting. Can you share a demo link?'", date: "Yesterday" },
        { type: "sent", label: "Sent outreach email with intro deck", date: "3 days ago" },
        { type: "note", label: "Researched portfolio overlap and thesis alignment", date: "5 days ago" }
      ],
      draftOutreach: `Hi Sarah,

Great to see your thoughts on LLM-first development environments. 

At Aether Dynamics, we're building a spatial system that orchestrates agent fleets for autonomous codebase refactoring. It addresses the exact bottleneck you described in your recent blog post.

Here is a 2-minute Loom showcasing our code-generation engine in action. I'd love to share our Seed memo if you're open to it.

Best,
Alex`,
      nextAction: "Send Demo Link & Pitch Deck"
    },
    {
      id: "person_priya",
      name: "Priya Sharma",
      role: "Partner",
      company: "Sequoia Capital",
      avatar: "PS",
      status: "researched",
      relevance: 94,
      relevanceReason: "Led Sequoia's recent investment in autonomous agent infrastructure. Focuses on developer middleware.",
      whyMatter: "Priya recently set up Sequoia's new developer systems practice. She represents an ideal tier-1 lead investor who understands developer ecosystems deeply.",
      goalId: "goal_funding",
      tags: ["AI Infra", "B2B SaaS", "Series A", "Ex-Engineer"],
      insights: [
        "Written extensively on the transition from copilot autocomplete tools to autonomous software agents.",
        "Values clear product vision and engineering velocity above initial ARR numbers.",
        "Former VP of Engineering at HashiCorp."
      ],
      timeline: [
        { type: "note", label: "Profile parsed and enriched by Relay AI", date: "2 days ago" }
      ],
      draftOutreach: `Hi Priya,

I followed your piece on the developer middleware layer transition. 

We are building Aether Dynamics, an orchestration workspace that allows AI agents to refactor complex legacy enterprise applications autonomously. We've solved the context-window drift issue you pointed out using a novel vector spatial cache.

I know you look at developer infra early. I'd love to get your developer feedback on our approach.

Best,
Alex`,
      nextAction: "Send Outreach Email"
    },
    {
      id: "person_david",
      name: "David Park",
      role: "Managing Director",
      company: "Scale Horizon",
      avatar: "DP",
      status: "outreach",
      relevance: 88,
      relevanceReason: "Invests in enterprise AI platforms. Strong connections to fortune 500 decision makers.",
      whyMatter: "David represents a strategic capital partner who can directly open doors to early pilot users in legacy industries.",
      goalId: "goal_funding",
      tags: ["Enterprise AI", "Network Integrator", "New York"],
      insights: [
        "Prefers metrics-driven pitches focusing on market size and distribution strategy.",
        "Known to introduce early-stage portfolio companies to massive customer accounts immediately.",
        "Maintains a strict follow-up response window (usually within 48h)."
      ],
      timeline: [
        { type: "sent", label: "Emailed pitch deck and executive summary", date: "5 days ago" },
        { type: "note", label: "Identified mutual connection via Clara Jenkins", date: "6 days ago" }
      ],
      draftOutreach: `Hi David,

Following up on my note from earlier this week. I know you're busy scale-matching enterprise startups.

Just wanted to add that we recently closed our third pilot customer, hitting $60k in pilot contract value. This demonstrates the enterprise pull we are seeing for code agents.

Let me know if this merits a brief intro call.

Best,
Alex`,
      nextAction: "Send Follow-up Email"
    },
    {
      id: "person_elena",
      name: "Elena Rostova",
      role: "Associate Partner",
      company: "Blue Horizon Capital",
      avatar: "ER",
      status: "scheduled",
      relevance: 82,
      relevanceReason: "Sourced blue-chip developer tooling deals. Direct reports to the founding GP.",
      whyMatter: "Elena is a key gatekeeper at Blue Horizon. Passing her review guarantees a meeting with the investment committee.",
      goalId: "goal_funding",
      tags: ["Developer Platforms", "SaaS", "Bay Area"],
      insights: [
        "Very rigorous about technical architecture details; expect questions on system scaling.",
        "Frequently reads engineering blogs of startups before meeting them."
      ],
      timeline: [
        { type: "meeting", label: "Introductory Meeting Scheduled", date: "June 22 at 2:00 PM" },
        { type: "received", label: "Accepted meeting invitation", date: "2 days ago" },
        { type: "sent", label: "Sent meeting request link", date: "4 days ago" }
      ],
      draftOutreach: `Hi Elena,

Looking forward to our discussion next Monday. 

I'm putting together a brief architecture overview document highlighting how we handle sandboxed execution environments for our refactoring agents. I'll send it over a day in advance so we can spend our time on deep questions.

Best,
Alex`,
      nextAction: "Prepare Technical Deck"
    },
    {
      id: "person_tom",
      name: "Tom Henderson",
      role: "Angel Investor",
      company: "Independent",
      avatar: "TH",
      status: "undiscovered",
      relevance: 75,
      relevanceReason: "Former VP Product at GitHub. Active angel investor in developer tools.",
      whyMatter: "Tom's product background makes him a stellar advisor. His backing would signal strong product credibility to VCs.",
      goalId: "goal_funding",
      tags: ["GitHub Veteran", "Angel", "Product advisor"],
      insights: [
        "Loves discussing workflows, developer experience (DX), and CLI aesthetics.",
        "Invests early ($25k-$50k tickets) and is highly hands-on with product feedback."
      ],
      timeline: [
        { type: "note", label: "Identified by AI as potential product advisor and angel", date: "Today" }
      ],
      draftOutreach: `Hi Tom,

I'm a founder building in the developer tools space. Long admirer of your product decisions at GitHub.

We are working on Aether Dynamics, focusing on making autonomous codebase changes feel safe and clear to engineers. 

I'd love to show you our developer terminal UI and get your product feedback. No pitch, just DX discussion.

Best,
Alex`,
      nextAction: "Review Advisor Fit"
    },
    {
      id: "person_marcus",
      name: "Marcus Vance",
      role: "Staff AI Engineer",
      company: "Anthropic",
      avatar: "MV",
      status: "active",
      relevance: 98,
      relevanceReason: "Expert in LLM context-window systems and model alignment. Author of key papers on agent frameworks.",
      whyMatter: "Marcus possesses the rare combination of deep systems engineering and advanced model tuning required to build Aether's core engine. He is currently exploring early-stage startup opportunities.",
      goalId: "goal_cofounder",
      tags: ["Anthropic Staff", "Systems Engineer", "LLM Specialist", "MIT Alum"],
      insights: [
        "Recently updated his LinkedIn status to 'Exploring new technical frontiers.'",
        "Author of 'Distributed Context Caching for Autonomous Systems.'",
        "Co-developed the early agent routing prototype at Anthropic."
      ],
      timeline: [
        { type: "received", label: "Replied: 'Interesting architecture. I'd be up for a coffee chat.'", date: "3 days ago" },
        { type: "sent", label: "Shared architecture outline and system bottleneck details", date: "4 days ago" },
        { type: "note", label: "Identified shared interest in low-level compiler design", date: "6 days ago" }
      ],
      draftOutreach: `Hi Marcus,

Great to hear you're open to grabbing coffee. 

Let's meet up at Blue Bottle on 2nd St this Thursday around 10 AM if that works? 

I'd love to chat about compiler-integrated LLM architectures and show you some of the systems bottlenecks we're solving.

Best,
Alex`,
      nextAction: "Confirm Coffee Meetup"
    },
    {
      id: "person_elizabeth",
      name: "Dr. Elizabeth Cho",
      role: "Postdoc Researcher",
      company: "Stanford AI Lab",
      avatar: "EC",
      status: "researched",
      relevance: 91,
      relevanceReason: "Pioneering work in multi-agent collaboration systems. Expert in code generation models.",
      whyMatter: "Elizabeth's academic research solves the exact multi-agent communication problems Aether will face at scale. She wants to transition from academia to product.",
      goalId: "goal_cofounder",
      tags: ["PhD AI", "Stanford", "Agent Systems", "Research-to-Product"],
      insights: [
        "Awarded best paper at NeurIPS for research on structured agent communication languages.",
        "Passionate about creating usable interfaces for complex machine learning technologies."
      ],
      timeline: [
        { type: "note", label: "AI scraped research publication record and Stanford status", date: "3 days ago" }
      ],
      draftOutreach: `Dear Elizabeth,

I recently read your NeurIPS paper on structured agent communications. It was a refreshing approach to reducing state-space explosion in multi-agent runs.

I'm building Aether Dynamics, focusing on applying multi-agent loops to industrial software migration. We are facing real-world versions of the synchronization bottlenecks you highlighted.

I'd love to share our technical challenge document and learn about your timeline for transitioning to industry.

Best,
Alex`,
      nextAction: "Send Academic Outreach"
    },
    {
      id: "person_arjun",
      name: "Arjun Mehta",
      role: "Core Tech Lead",
      company: "Vercel",
      avatar: "AM",
      status: "undiscovered",
      relevance: 85,
      relevanceReason: "Expert in building highly interactive, real-time web applications. Deep understanding of developer experience.",
      whyMatter: "Arjun can build a beautiful, high-performance developer canvas that visualizes agent actions in real-time.",
      goalId: "goal_cofounder",
      tags: ["DX Designer", "Vercel Veteran", "React Expert", "London based"],
      insights: [
        "Maintains several popular open-source canvas-rendering libraries.",
        "Highly opinionated on animations, speed, and real-time state synchronization."
      ],
      timeline: [
        { type: "note", label: "Scouted on GitHub via open source canvas projects", date: "Today" }
      ],
      draftOutreach: `Hi Arjun,

I love your work on the react-canvas-flow library. The panning inertia and rendering performance are best-in-class.

I'm building Aether Dynamics, and we are designing a highly visual canvas interface to control fleets of refactoring agents in real-time. 

I'd love to get your thoughts on the performance limits of SVG vs Canvas for rendering 10,000+ interactive nodes.

Best,
Alex`,
      nextAction: "Request DX Feedback"
    },
    {
      id: "person_james",
      name: "James Wu",
      role: "VP Engineering",
      company: "TechFlow Solutions",
      avatar: "JW",
      status: "outreach",
      relevance: 95,
      relevanceReason: "Manages a team of 120 engineers maintaining massive legacy Node.js/Java applications.",
      whyMatter: "TechFlow has over 4 million lines of legacy code that they want to migrate to serverless. They are the perfect launch pilot partner.",
      goalId: "goal_pilots",
      tags: ["Enterprise Lead", "Legacy Systems", "100+ Devs", "TechFlow VP"],
      insights: [
        "Under intense pressure from the CTO to reduce legacy cloud upkeep costs by 30%.",
        "Extremely risk-averse; requires guaranteed fallback sandboxes and human-in-the-loop approvals."
      ],
      timeline: [
        { type: "sent", label: "Sent custom pilot proposal with pricing sheet", date: "2 days ago" },
        { type: "note", label: "Completed architecture alignment call", date: "6 days ago" }
      ],
      draftOutreach: `Hi James,

I know your team is reviewing the pilot migration proposal.

Just wanted to confirm that our software includes full git history preservation and instant sandbox rollbacks. Your engineers retain 100% control — agents only open PRs, they never push directly to main.

Let me know if your security lead has any remaining questions on the sandboxing model.

Best,
Alex`,
      nextAction: "Follow up on Proposal"
    },
    {
      id: "person_clara",
      name: "Clara Jenkins",
      role: "Head of Infrastructure",
      company: "Global Retail Inc",
      avatar: "CJ",
      status: "scheduled",
      relevance: 90,
      relevanceReason: "Oversees migration of e-commerce databases. Interested in automated refactoring tools.",
      whyMatter: "Global Retail represents a huge enterprise account. Closing a pilot with Clara proves Aether can handle massive scale and strict compliance environments.",
      goalId: "goal_pilots",
      tags: ["Retail Giant", "Infra Head", "Compliance focused"],
      insights: [
        "Requires SOC2 Type II compliance reports and private cloud hosting options.",
        "Speaks regularly at DevOps summits on infrastructure modernization."
      ],
      timeline: [
        { type: "meeting", label: "Pilot Demo and Security Review Scheduled", date: "June 25 at 11:00 AM" },
        { type: "received", label: "Emailed: 'Please send over security self-assessment beforehand.'", date: "4 days ago" }
      ],
      draftOutreach: `Hi Clara,

Ahead of our security review next Thursday, I've compiled our sandboxing architecture outline and our completed VSAQ security questionnaire.

You can access the secure folder here. Our agent network executes entirely inside isolated Firecracker microVMs, meaning zero exposure to your core VPC.

Looking forward to the demo.

Best,
Alex`,
      nextAction: "Send Security Questionnaire"
    },
    {
      id: "person_wei",
      name: "Wei Zhang",
      role: "CTO",
      company: "Novus Financial",
      avatar: "WZ",
      status: "researched",
      relevance: 87,
      relevanceReason: "Modernizing financial backend systems. Needs high reliability code translations.",
      whyMatter: "Financial tech has strict compliance but massive modernization budgets. Wei is looking for automated tools to refactor Cobol to Java.",
      goalId: "goal_pilots",
      tags: ["FinTech CTO", "High Budget", "COBOL Modernization"],
      insights: [
        "Highly technical CTO who writes code himself on weekends.",
        "Strict regulatory requirements regarding data provenance and explainability of AI suggestions."
      ],
      timeline: [
        { type: "note", label: "Scouted Wei's panel talk at FinTech Innovate", date: "4 days ago" }
      ],
      draftOutreach: `Hi Wei,

I saw your panel at FinTech Innovate on the cost of COBOL debt in modern banking backends.

At Aether Dynamics, we've built a specialized translation agent that maps COBOL loops to clean, functional Java, complete with automated JUnit test generation ensuring zero semantic drift.

I know banking requirements are extreme. I'd love to run a single offline translation sample for you to review at your convenience.

Best,
Alex`,
      nextAction: "Reach out via Email"
    }
  ],
  briefingItems: [
    {
      id: "brief_1",
      type: "reply",
      title: "Sarah Chen replied to your pitch",
      desc: "Sentiment is highly positive. She requested a demo link. This is critical for your Seed Round goal.",
      meta: "GOAL: RAISE SEED ROUND • 16h ago",
      targetId: "person_sarah"
    },
    {
      id: "brief_2",
      type: "followup",
      title: "Follow up with James Wu at TechFlow",
      desc: "It has been 2 days since you sent the pilot proposal. He is evaluating automated migration risks.",
      meta: "GOAL: SECURE PILOT CUSTOMERS • 2d ago",
      targetId: "person_james"
    },
    {
      id: "brief_3",
      type: "discovery",
      title: "New match: Marcus Vance (Anthropic Staff)",
      desc: "Highly relevant to Find Co-founder goal. Author of papers on context caching. Exploring startup roles.",
      meta: "98% RELEVANCE MATCH • TODAY",
      targetId: "person_marcus"
    },
    {
      id: "brief_4",
      type: "milestone",
      title: "Active conversations hitting critical mass",
      desc: "You have 3 active investor conversations. Recommended: Coordinate meeting schedules to create competitive tension.",
      meta: "RAISE SEED ROUND • SYSTEM INSIGHT",
      targetId: "goal_funding"
    }
  ]
};
