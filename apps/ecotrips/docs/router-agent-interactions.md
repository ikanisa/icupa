# Router-Agent Interaction Diagrams

These diagrams summarize how the ecoTrips router delegates domain work to the specialist agents defined in `agents/agent_registry.yaml`. Use them as orientation aids when wiring orchestration logic or reviewing fallback paths.

## Trip Planning & Storytelling

```mermaid
flowchart TD
    subgraph Router
        direction TB
        Intent[Traveler Intent Parser]
        Risk[Risk Appetite Heuristics]
        Memory[Memory Scope Resolver]
    end

    Intent --> PlannerCoPilot
    Risk --> SafetyAgent
    Memory --> PlannerCoPilot
    PlannerCoPilot --> QuoteTools[quote.search & inventory.hold]
    PlannerCoPilot --> CheckoutIntent[checkout.intent]
    PlannerCoPilot --> NotifyWA[notify.whatsapp_send]
    PlannerCoPilot --> Permits[permits.request]
    PlannerCoPilot --> MapRoute[map.route]

    SafetyAgent --> MapRoute
    SafetyAgent --> NotifyWA

    Router --> ContentMarketingAgent
    ContentMarketingAgent --> PlannerCoPilot
    ContentMarketingAgent --> MapRoute
    ContentMarketingAgent --> NotifyWA
```

- **PlannerCoPilot** owns itinerary synthesis, price integrity, and memory updates across `short_term`, `working_plan`, and `long_term` scopes while invoking bundled quote/search tooling.
- **SafetyAgent** evaluates daylight and advisory heuristics, intercepting risky legs before the traveler sees them, and relays urgent updates via WhatsApp.
- **ContentMarketingAgent** repackages confirmed itinerary data into shareable cards or SEO-friendly snippets and cross-checks availability against the Planner outputs.

## In-Trip & Support Operations

```mermaid
sequenceDiagram
    participant Router
    participant ConciergeGuide
    participant SupportCopilot
    participant SafetyAgent
    participant SupplierOpsAgent

    Router->>ConciergeGuide: Daily briefing request
    ConciergeGuide->>Router: Itinerary status + traveler context
    Router->>SafetyAgent: Route safety evaluation
    SafetyAgent-->>Router: Alerts & escalation triggers
    Router->>SupportCopilot: Incident triage with ops.bookings lookup
    SupportCopilot-->>Router: Structured summary + HITL flags
    Router->>SupplierOpsAgent: Supplier SLA check & follow-up
    SupplierOpsAgent-->>Router: Performance notes → team_memory
```

- **ConciergeGuide** keeps travelers on schedule by combining `map.route`, `map.nearby`, and WhatsApp nudges with itinerary context.
- **SupportCopilot** manages post-booking incidents, coordinating refunds, rebookings, or payouts with strict human-in-the-loop guardrails.
- **SupplierOpsAgent** monitors supplier confirmations, retries safe automations, and feeds team-wide learnings into `team_memory` scopes.
- **SafetyAgent** continues to monitor live travel segments and warns both Concierge and Support about emergent risks.

## Group Savings & Finance Safeguards

```mermaid
graph LR
    Router((Router)) --> GroupBuilder
    GroupBuilder -->|Escrow lifecycle| GroupsTools[groups.create_escrow / groups.join / groups.contribute]
    Router --> SupportCopilot
    Router --> FinOpsAgent
    Router --> SupplierOpsAgent
    FinOpsAgent -->|Daily reconciliation| CheckoutIntent
    FinOpsAgent -->|Payout governance| GroupsPayouts[groups.payout_now / groups.payouts_report]
    SupportCopilot -->|Manual payout confirmation| GroupsPayouts
    SupplierOpsAgent -->|Exception follow-up| GroupsPayouts
```

- **GroupBuilder** handles social savings campaigns, ensuring transparent contribution progress and highlighting refund policies inside every summary.
- **FinOpsAgent** reconciles payments, supervises refunds, and enforces dual control across Stripe webhooks and payout flows.
- **SupportCopilot** authorizes payout or refund exceptions only after human review, coordinating with Finance for ledger accuracy.
- **SupplierOpsAgent** keeps supplier-driven payouts or adjustments aligned with confirmation SLAs and escalation policies.

> **Note:** When onboarding new agents, extend these diagrams to illustrate how additional memory scopes, guardrails, and tool bundles fit into the router’s delegation model.
