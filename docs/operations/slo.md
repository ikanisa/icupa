# ICUPA Service Level Objectives

This document captures the initial SLOs used to monitor the ICUPA platform. Values represent baseline targets; they should be refined once production telemetry is available.

## Core Principles

- **Customer trust:** Prioritize booking, ordering, and payment flows.
- **Observability:** SLOs are backed by Prometheus metrics and synthetic tests.
- **Actionability:** Breaching an SLO must trigger an alert with a documented runbook.

## Service Map

| Service | Description | Priority |
| ------- | ----------- | -------- |
| Agents API | Fastify service powering AI-assisted workflows | P0 |
| Client PWA | Customer-facing ordering experience | P0 |
| Admin PWA | Backoffice management console | P1 |
| Vendor PWA | Supplier onboarding & inventory | P1 |
| Voice Agent | Twilio voice concierge | P1 |
| OCR Converter | Document ingestion helper | P2 |

## Availability Objectives

| Service | Target Availability | Measurement Window | Notes |
| ------- | ------------------ | ------------------ | ----- |
| Agents API | 99.5% | 30 days | Calculated from HTTP 5xx ratio + synthetic `/health` ping |
| Client PWA | 99.7% | 30 days | Uptime robot synthetic + Core Web Vitals availability |
| Admin PWA | 99.0% | 30 days | Based on `/` availability |
| Vendor PWA | 99.0% | 30 days | Based on `/` availability |
| Voice Agent | 99.0% | 30 days | Twilio webhook success + service `/ready` endpoint |
| OCR Converter | 98.0% | 30 days | `/health` success rate |

## Latency Objectives

| Endpoint | Target p95 | Window |
| -------- | ---------- | ------ |
| Agents API `/ai/respond` | < 1200 ms | 30 days |
| Agents API `/health` | < 200 ms | 30 days |
| Client PWA page load (Largest Contentful Paint) | < 2.8 s | Rolling 7 days |
| Voice Agent audio handshake | < 500 ms | Rolling 7 days |

## Error Budget Policy

- Error budgets are tracked weekly.
- If >50% of the monthly error budget is consumed, freeze feature deployments and execute a reliability review.
- If >75% is consumed, initiate incident response and appoint a Reliability Captain until recovery.

## Monitoring & Alerting

- Metrics collected via Prometheus/Grafana with synthetic checks (k6 + Playwright smoke suites).
- Alerts fire when projected availability drops below the SLO for two consecutive evaluation periods.
- Incident response is documented in `docs/operations/runbooks/` (to be authored in follow-up work).

## Review Cadence

- SLOs are reviewed quarterly with Product and Reliability stakeholders.
- Update this document and notify the `#reliability` Slack channel with any change.
