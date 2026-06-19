# Relay AI

**Autonomous Relationship Intelligence Platform**

Relay AI helps founders, startups, researchers, and teams discover the right people to connect with, identify high-value opportunities, and execute personalized outreach using AI-powered workflows.

Instead of acting like a traditional chatbot, Relay AI functions as an intelligent relationship workspace that combines conversation memory, contact discovery, outreach automation, Gmail integration, and dynamic AI model selection.

## Core Capabilities

* Discover relevant investors, partners, customers, and organizations.
* Generate personalized outreach emails.
* Monitor and manage follow-ups.
* Connect and synchronize Gmail accounts.
* Maintain persistent conversation workspaces with long-term memory.
* Switch between AI providers and models in real time.
* Bring your own API keys for supported providers.
* Store context, conversations, and actions across sessions.

## Key Features

### Persistent Conversation Workspaces

Every interaction is saved within a dedicated workspace.

Relay AI automatically maintains:

* Conversation history
* Context memory
* Goals and preferences
* Related contacts
* Generated opportunities
* Outreach activities

### Relationship Intelligence

Provide context about your project, startup, product, or objectives, and Relay AI can:

* Identify relevant organizations
* Find potential investors
* Surface strategic partnerships
* Prioritize outreach targets
* Recommend follow-up actions

### Outreach Automation

Relay AI helps you:

* Draft personalized emails
* Track follow-ups
* Organize contacts
* Manage outreach pipelines
* Monitor Gmail conversations

### Bring Your Own AI

Users can connect their own API keys and select their preferred model.

Supported providers:

* Relay Cloud (Mercury 2)
* Google Gemini
* OpenAI
* Anthropic
* OpenRouter

Model selection is available directly from the conversation interface.

## Architecture

```text
User Prompt
    ↓
Conversation Workspace
    ↓
Context Builder
    ↓
Provider Router
    ↓
Selected AI Provider
    ↓
Response Generation
    ↓
Usage Logging
    ↓
Persistent Memory
```

## Tech Stack

### Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* shadcn/ui

### Backend

* Next.js Route Handlers
* Firebase Firestore
* Firebase Admin SDK
* Auth.js (NextAuth)

### AI Layer

* Mercury 2
* Google Gemini
* OpenAI
* Anthropic
* OpenRouter

### Security

* AES-256-GCM encryption
* Server-side API key management
* OAuth 2.0
* Google Gmail API

## Project Structure

```text
app/
├── api/
├── (auth)/
├── (dashboard)/
│   ├── briefing/
│   ├── relationships/
│   ├── outreach/
│   ├── follow-ups/
│   ├── gmail/
│   ├── api/
│   ├── profile/
│   └── c/[conversationId]/

lib/
├── ai/
│   ├── providers/
│   ├── memory/
│   ├── orchestration/
│   └── context-builder.ts
├── auth/
├── firestore/
└── encryption.ts
```

## Environment Variables

Create a `.env.local` file:

```env
# Authentication
AUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Gmail API
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Relay Cloud
MERCURY_API_KEY=

# Security
ENCRYPTION_KEY=

# Optional AI Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Firestore Collections

```text
users/
conversations/
messages/
conversation_memory/
contacts/
opportunities/
follow_ups/
usage_logs/
user_ai_settings/
users/{userId}/api_keys/
```

## Development Roadmap

### Phase 1

* Persistent conversations
* Gmail integration
* AI provider switching
* BYOK support

### Phase 2

* Opportunity discovery engine
* Relationship graph
* Automated follow-up workflows
* Conversation summaries

### Phase 3

* Autonomous outreach agents
* Multi-step workflows
* Team collaboration
* CRM integrations

## Security Principles

* API keys are encrypted before storage.
* Decrypted credentials never reach the client.
* All AI requests are executed server-side.
* User data is isolated through Firestore security rules.
* Gmail permissions follow least-privilege access principles.

## Vision

Relay AI is building an intelligence layer for relationship management.

The goal is not to help users write emails faster.

The goal is to help users discover the right opportunities, connect with the right people, and execute high-quality outreach with AI acting as an autonomous relationship strategist.

---

Built with Next.js, Firebase, and AI.
