# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Admin Console (2025-11-02)

- Documented the admin console deployment settings, including Vercel build commands, secret mappings, and domain aliases for `apps/admin`.【F:deployments/admin/README.md†L1-L81】
- Added an operator runbook covering monitoring, feature flag procedures, rollback guidance, and rollout notes for the admin surface.【F:docs/runbooks/admin.md†L1-L49】

#### AI Agents Infrastructure (2025-10-30)

- **AI Package** - Complete AI agent framework with OpenAI Responses and Realtime API integration
  - Shared schemas with Zod validation and JSON Schema export
  - OpenAI Responses API client and tool router
  - Realtime API SIP session handler and tool bridge
  - AgentKit configuration system (graph.json, connectors.json, evals.json)
  - Eval framework with graders (tool args, hallucination, PII leak)

- **Supabase Functions** - Backend functions for voucher operations
  - `lookup_customer` - Find customer by MSISDN
  - `create_voucher` - Create and persist voucher
  - `redeem_voucher` - Redeem issued voucher
  - `void_voucher` - Void issued voucher

- **API Endpoints** - WhatsApp and voice integration endpoints
  - WhatsApp webhook handler with verification
  - WhatsApp message sender with templates
  - Realtime API webhook for tool callbacks
  - Health check endpoint

- **Configuration** - Observability and feature management
  - OpenTelemetry tracing configuration
  - Structured logging with PII redaction
  - Feature flags for gradual rollout

- **Documentation**
  - Comprehensive setup and usage guide (`docs/agents/README.md`)
  - Migration and rollback guide (`docs/agents/migration.md`)
  - Operational runbooks (`docs/agents/runbooks.md`)

- **Testing**
  - 35 unit tests for AI components (100% passing)
  - Eval runner for golden conversation testing
  - CI eval script for automated testing

- **Dependencies**
  - `zod-to-json-schema` - Schema conversion
  - `@opentelemetry/sdk-node` - Distributed tracing
  - `@opentelemetry/exporter-trace-otlp-http` - Telemetry export

#### Repository Refactor Documentation (2025-11-01)

- Post-implementation report for RFC-001 capturing migration steps, validation results, and follow-up work (`docs/rfc-001-repo-refactor.md`).
- New governance guides: audit inventory (`docs/audit-inventory.md`), tenancy policy (`docs/tenancy.md`), engineering onboarding (`docs/onboarding.md`).
- Zero downtime migration runbook (`docs/runbooks/zero-downtime-migration.md`).

### Changed

- Updated `.env.example` with new environment variables for WhatsApp, SIP, and observability
- Updated `vite.config.ts` to include `ai/` directory in test paths
- Refreshed go-live and release runbooks with phased rollout, feature flag, and SLO monitoring procedures (`docs/runbooks/go-live.md`, `docs/release-runbook.md`).
- Updated agents-service and rollback runbooks to reflect new architecture and audit requirements (`docs/runbooks/agents-service.md`, `docs/runbooks/rollback-log.md`).
- Expanded `SECURITY.md` with tenancy guardrails, CI/CD controls, and operational contacts.

### Fixed

#### Admin Console Tooling (2025-11-02)

- Updated Tailwind v4 integration for the admin workspace by adopting `@tailwindcss/postcss`, aligning dark-mode presets, and swapping the gradient utility for a static background colour to unblock builds.【F:apps/admin/postcss.config.mjs†L1-L6】【F:postcss.config.js†L1-L12】【F:packages/ui/src/styles.css†L1-L71】【F:apps/admin/tailwind.config.ts†L1-L15】
- Normalised shared configuration by extending the Tailwind preset and Zod enums so admin feature toggles compile cleanly with TypeScript type checking enabled.【F:packages/config/tailwind-preset.ts†L1-L69】【F:packages/types/src/apps.ts†L1-L18】

### Security

- PII redaction in logs (phone numbers, emails, credit cards)
- Input validation with Zod schemas for all tool arguments
- Idempotency handling for WhatsApp messages
- No secrets stored in repository

## [0.1.0] - Previous

(Previous changelog entries would go here)
