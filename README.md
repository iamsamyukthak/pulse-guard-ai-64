# TrustGuard AI

We are building a hackathon project called "TrustPulse — AI-Powered Real-Time Payment Fraud Intelligence & Response Platform".

IMPORTANT:

This is not a static UI mockup. Every major feature must be functional and connected to real application state and backend data.

GOAL:

Build a complete end-to-end fraud intelligence prototype that can be demonstrated live to hackathon judges.

PRIMARY DEMO STORY:

A payment enters the system in real time.

The system enriches the transaction with user/device/location/history context.

The transaction is evaluated using:

1. deterministic fraud rules

2. behavioral anomaly detection

3. relationship/graph-based fraud analysis

The signals are combined into a risk score from 0 to 100.

The system chooses:

0–39 APPROVE

40–69 MONITOR

70–89 STEP-UP AUTHENTICATION

90–100 BLOCK

High-risk transactions generate alerts.

Investigators can open a case, inspect the risk factors, view related accounts/devices/IPs/merchants, and ask the AI Fraud Copilot questions.

The analyst can confirm fraud, mark false positive, or escalate.

The feedback is stored for future learning and analytics.

TECH STACK:

Frontend:

- React

- TypeScript

- Tailwind CSS

- shadcn/ui if appropriate

- Lucide icons

- Recharts for charts

- React Flow or another suitable graph visualization library

Backend:

- Supabase

- PostgreSQL

- Supabase Realtime

- Supabase Edge Functions written in TypeScript

Fraud intelligence:

- TypeScript rule engine

- statistical anomaly detection / Isolation Forest-style anomaly scoring implemented in TypeScript or a suitable browser/server-compatible library

- explainability layer

- relationship graph analysis implemented in TypeScript

- do not require Python for the core demo

AI:

- AI Fraud Copilot architecture must be provider-agnostic

- Prefer a browser/local LLM approach with no mandatory paid API

- The LLM must NEVER independently calculate or invent the fraud score

- The backend risk engine is authoritative

- The LLM only summarizes evidence, explains existing risk factors, answers evidence-grounded questions, and suggests investigation actions

DATABASE:

Create proper relational tables for:

- users

- accounts

- transactions

- devices

- merchants

- ip_addresses

- fraud_alerts

- investigation_cases

- investigation_notes

- analyst_feedback

- fraud_relationships

- risk_events

- watchlist_entities

- attack_scenarios

- system_metrics

REAL-TIME:

Transactions must appear live in the dashboard without page refresh.

Alerts must appear live.

Risk score changes must be reflected immediately.

SECURITY:

Use Supabase Row Level Security appropriately.

Do not expose service-role credentials to the frontend.

Never put secret API keys in client-side code.

UX:

Create a professional enterprise fraud-operations interface.

Dark security/fintech visual language.

High information density but clean.

Responsive.

Fast.

Clear severity states.

No fake buttons.

No dead navigation.

No placeholder features that claim to work.

DEMO REQUIREMENTS:

Include a dedicated Attack Simulator with:

1. Impossible Travel

2. High Velocity Attack

3. Account Takeover

4. Card Testing

5. Fraud Ring

Every scenario must generate actual transactions and trigger the real fraud engine.

IMPORTANT DEMO PRINCIPLE:

The judge should trigger the attack, not manually block the transaction.

The system should automatically detect high-risk transactions and produce the BLOCK decision.

Investigator actions should be available afterward for confirmation, release, escalation, and feedback.

Do not over-engineer the first version.

Build modularly.

Create clean reusable services and components.

Use realistic synthetic data.

Use deterministic seeds where useful so demos are reproducible.

Do not change the architecture casually.

Before implementing a module, inspect the current application and preserve previously working functionality.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pulse-guard-ai-64.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/32724efd-a2d0-4020-bae4-3f6eda321f4a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
