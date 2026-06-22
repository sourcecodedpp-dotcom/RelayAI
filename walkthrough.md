# Relay AI — Walkthrough (Firebase & Inception Labs Mercury 2 Migration)

We have successfully designed and implemented the production-grade codebase foundation for **Relay AI**, transitioning the project into a single Next.js App Router application with multi-user isolation by default, using **Firebase Firestore** as the database layer and **Inception Labs Mercury 2** as the core AI service engine.

---

## 1. Structural Changes & Folder Structure

The project has been structured into a feature-centric Next.js application:

```text
relay-ai/
├── app/                        # Next.js App Router
│   ├── (auth)/login/           # Server-action Google OAuth Login
│   ├── (dashboard)/            # Secure dashboard layout and pages
│   │   ├── briefing/           # Priorities briefing feed
│   │   ├── opportunities/      # Auditable opportunity list
│   │   ├── relationships/      # Immersive Canvas orbit view
│   │   ├── outreach/           # AI Email draft control board
│   │   └── settings/           # Goal and connection settings
│   ├── api/                    # Centralized API Route Handlers
│   │   ├── auth/               # next-auth callbacks and profile endpoints
│   │   ├── contacts/           # Contact creation and AI research triggers
│   │   ├── goals/              # Goal definition endpoints
│   │   ├── opportunities/      # Prioritized feed and update endpoints
│   │   └── followups/          # Calendar reminders handlers
│   ├── layout.tsx              # Root HTML and fonts
│   └── page.tsx                # Auth index redirect
├── components/                 # Global UI components
│   ├── sidebar.tsx             # Collapsible Navigation Sidebar
│   ├── command-bar.tsx         # AI Command Bar (⌘K launcher)
│   └── orbit-canvas.tsx        # HTML5 Canvas Spatial relationships visualizer
├── lib/                        # Backend system services
│   ├── ai/                     # Inception Labs Mercury-2 completions provider
│   ├── auth/                   # next-auth v5 setup & secure session helpers
│   ├── db/                     # Cloud Firestore connection initializer (with proxy fallback for builds)
│   ├── gmail/                  # Gmail drafts and thread sync client
│   └── security/               # Crypto (AES-256-GCM), rate limits, CSP config
├── styles/                     # Tailwind CSS and global style directives
├── types/                      # Custom TypeScript enums & interfaces
├── tailwind.config.ts          # Custom color palette and font pairing tokens
├── tsconfig.json               # Strict TypeScript configurations
└── next.config.js              # Next.js compiler settings
```

---

## 2. Multi-Tenant Security & API Authorization

We have enforced a strict design pattern guaranteeing **tenant isolation**:
* **No Client-side User IDs**: Every API route derives the User ID exclusively from the verified server-side session.
* **Strict Filter Enforcement**: Every Firestore transaction filters explicitly by the active `userId` using `.where("userId", "==", userId)`.
* **Encryption at Rest**: Google OAuth Refresh Tokens are encrypted in Firestore using **AES-256-GCM** (authenticated encryption) in the `google_connections` collection, supporting key versioning and future key rotation.

---

## 3. Database Schema: Cloud Firestore Collections

Firestore structures data in flat documents. The models map as:

| Collection Name | Document ID | Fields |
| :--- | :--- | :--- |
| `users` | `userId` | `email`, `name`, `avatarUrl`, `onboardingCompleted` (bool), `primaryUseCase`, `outreachGoals`, `createdAt`, `updatedAt` |
| `google_connections` | `userId` | `email`, `encryptedRefreshToken`, `keyVersion`, `gmailHistoryId`, `createdAt`, `updatedAt` |
| `goals` | `goalId` (UUID) | `userId` (owner), `title`, `description`, `isActive` (bool), `createdAt`, `updatedAt` |
| `contacts` | `contactId` (UUID) | `userId`, `goalId`, `name`, `company`, `role`, `email`, `notes`, `relationshipStatus` (enum string), `createdAt`, `updatedAt` |
| `research` | `contactId` | `userId`, `contactId`, `data` (JSON map of company info, background, news, insights - raw LLM responses cleaned), `createdAt`, `updatedAt` |
| `outreach_threads` | `threadId` | `userId`, `contactId`, `gmailThreadId`, `gmailLastMessageId`, `subject`, `status` ("DRAFT" \| "SENT"), `createdAt`, `updatedAt` |
| `follow_ups` | `followUpId` | `userId`, `contactId`, `title`, `scheduledAt` (Timestamp), `completedAt` (Timestamp), `status` ("PENDING" \| "COMPLETED"), `createdAt`, `updatedAt` |
| `opportunities` | `oppId` | `userId`, `contactId`, `followUpId`, `type`, `status` ("PENDING" \| "DISMISSED"), `priority` ("HIGH" \| "MEDIUM"), `title`, `description`, `priorityScore` (int), `createdAt`, `updatedAt` |
| `audit_logs` | `logId` | `userId`, `action`, `details` (stringified JSON), `userAgent`, `createdAt` |

---

## 4. Opportunity Briefing Engine (`lib/briefing/engine.ts`)

Briefing recommendations are prioritized by a numeric priority score (0 to 100), calculated dynamically as:

$$\text{Priority Score} = \text{Base Score} + \text{Urgency Multiplier}$$

* **Investor Replied**: Base score `90` + 1 point for every 4 hours unanswered (max +10).
* **Follow-up Due**: Base score `80` + 5 points boost if overdue.
* **New Contact Discovered**: Base score `50` (static).

Opportunities are loaded from Firestore and sorted directly using index-based ordering in database queries:
```typescript
const snapshot = await db.collection("opportunities")
  .where("userId", "==", userId)
  .where("status", "==", OpportunityStatus.PENDING)
  .orderBy("priorityScore", "desc")
  .get();
```

---

## 5. Gmail & AI Integration Layer

* **Google Scopes**: Configured `gmail.readonly`, `gmail.metadata`, and `gmail.send` scopes.
* **Metadata-Only Thread Sync**: Downloads message headers only, checking for replies without storing raw email content.
* **Inception Labs Mercury 2 Provider**: Interfaced using `AiProvider` and implemented via `MercuryProvider` in `lib/ai/mercury.ts` using the completions endpoint. Cleans and extracts raw JSON text fields for robust parsing.

---

## 6. Immersive Spatial Canvas Experience

Inside `components/orbit-canvas.tsx`, we built a high-fidelity relationship visualizer:
* **Radially Distributed Goals**: Active goals orbit the user center.
* **Clustered Contact Orbits**: Contacts orbit their linked goals based on relationship status and color signals.
* **Pan & Zoom**: Supports canvas dragging and mouse wheel zooming.
* **Drawer Dossiers**: Clicking a contact centers the canvas and opens their AI research profile in the drawer.

---

## 7. Setup & Local Development Guide

### Prerequisites
Install Node.js (v20+ recommended).

### Environment Configuration
Create a `.env` file in the root directory:
```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID="google-client-id"
GOOGLE_CLIENT_SECRET="google-client-secret"

# Auth.js Session Configuration
AUTH_SECRET="random-string-at-least-32-chars"

# Token Encryption (AES-256-GCM)
ENCRYPTION_KEY="random-key-at-least-32-chars"

# Firebase Cloud Firestore (Admin SDK Credentials)
FIREBASE_PROJECT_ID="labs-relay-ai"
# Generate in Firebase Console: Settings > Service Accounts > Generate new private key
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-replace-me@labs-relay-ai.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Inception Labs API (Mercury-2)
MERCURY_API_KEY="sk_9f2be70a3c2ec583b3cbe2de3cb067e8"
AI_PROVIDER="mercury"
```

### Installation & Startup
```bash
# 1. Install dependencies
npm install

# 2. Compile and check Types
npx tsc --noEmit

# 3. Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view your Daily Briefing.

---

## 8. Autonomous Swarm UI & Response Enhancements

We have polished the autonomous swarm system to ensure a professional, premium user experience:
* **De-cluttering intermediate system events**: Suppressed intermediate tool logs (e.g. search updates, contact creation logs) from being written to the conversation message thread when `isChat` is true. The chat feed remains perfectly clean while the typing indicator shows real-time progress.
* **Minimalist Chat Layout (No Avatars/Logos)**: Completely removed the avatar logo circles on both sides (the user's "US" bubble and the assistant's sparkle avatar) in the chat page, briefing page, and mission page conversations. Messages now align cleanly to the right (user) and left (assistant) edges for a modern, sleek interface.
* **Workspace Navigation Polish**: Restored the clean capability links (Orbits, Outreach, Inbox/Email, and API Monitor) to the sidebar navigation using the matching sleek layout, while keeping the "Briefing" and dedicated "Follow-ups" page links hidden to reduce visual noise.
* **Unified Profile & Settings Panel**: Merged all profile details (editable user name, avatar, account metrics, stats summary cards) with the preferences, connections, and strategic objectives forms into a single high-fidelity `/settings` dashboard. Relabeled the sidebar footer action to **"Profile & Settings"**.
* **Mini Sidebar Layout & Collapsible Toggles**: Completely redesigned the sidebar panel into a compact, minimalist layout matching the user's design reference (width `w-64`, outline-style New Conversation button, collapsible history panel, and clean nav links). Added full collapse support where clicking the chevron icon slides out the sidebar completely (`w-0`). A floating Menu icon at the top left of the content view lets users expand the sidebar back. Fixed viewport offsets in the chat view adapt dynamically using a CSS variable (`--sidebar-width`). Enabled scroll support (`max-h-[350px] overflow-y-auto`) inside the expanded history list.
* **Elevated Output Brilliance & Creativity**: Refined Swarm Coordinator prompt guidelines to produce a beautifully formatted markdown dossier on completion. The response includes an Investor Match Dossier (with thesis alignment and check sizes), a checklist of automated database records created, a fully customized outreach email preview resolving RCP context placeholders, and actionable creative tips.
