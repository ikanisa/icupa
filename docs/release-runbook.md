# Release Runbook

This comprehensive runbook documents the complete process for building, testing, staging, deploying, and operating ICUPA in production environments.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Setup](#environment-setup)
- [Build & Test](#build--test)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring & Alerts](#monitoring--alerts)
- [On-Call Handoff](#on-call-handoff)
- [Common Issues & Resolutions](#common-issues--resolutions)

## Pre-Deployment Checklist

### Code Quality Gates

- [ ] All CI checks pass (lint, typecheck, build)
- [ ] Test coverage meets threshold (≥80% or baseline +10%)
- [ ] No high/critical security vulnerabilities (CodeQL, dependency audit)
- [ ] No secrets in code (secret scanning passed)
- [ ] Code review approved by required owners
- [ ] Architecture boundaries respected (no circular dependencies)
- [ ] Breaking changes documented with migration plan

### Database & Schema

- [ ] All migrations are forward-only and tested
- [ ] Rollback strategy documented for each migration
- [ ] Migration tested in staging environment
- [ ] Indexes optimized for hot queries
- [ ] RLS policies validated with test suite

### Documentation

- [ ] Release notes prepared
- [ ] Breaking changes documented
- [ ] Migration guide updated (if needed)
- [ ] Runbook updated with any new procedures
- [ ] API contract changes documented

### Dependencies

- [ ] All dependencies audited for vulnerabilities
- [ ] Critical dependencies pinned to specific versions
- [ ] No major version updates without compatibility testing
- [ ] Transitive dependencies reviewed

### Feature Flags

- [ ] New features behind feature flags
- [ ] Kill switches tested and operational
- [ ] Gradual rollout plan defined
- [ ] Rollback plan includes feature flag state

## Environment Setup

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start Supabase locally (requires Docker)
supabase start
supabase db reset --local --yes
supabase seed --local --yes

# 4. Start development servers
pnpm dev           # Web app on port 8080
pnpm dev:agents    # Agents service on port 8787
```

### Staging Environment

Staging should mirror production as closely as possible:

- Same database version (PostgreSQL 15+)
- Same Supabase version
- Same Node.js version (18.18.2+)
- Same resource limits (CPU, memory)
- Separate Supabase project (staging)
- Separate secrets and API keys (non-production)

### Production Environment

**Supabase Project:**
- Project ID: `<prod-project-id>`
- Region: `<region>`
- Database: PostgreSQL 15+ with pgvector
- Storage: Multi-region replication enabled

**Hosting:**
- Web App: Vercel/Netlify with CDN
- Agents Service: Cloud Run/ECS with auto-scaling
- Edge Functions: Supabase Edge Functions (Deno)

## Build & Test

### 1. Install Dependencies

```bash
# Use pnpm for consistent dependency resolution
pnpm install --frozen-lockfile
```

### 2. Lint & Type Check

```bash
# Lint all code
pnpm lint

# Type check
pnpm typecheck

# Format check (optional in CI)
pnpm format:check
```

### 3. Run Unit Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test --coverage

# Verify coverage meets threshold
pnpm test --coverage --coverageThreshold='{"global":{"lines":80}}'
```

### 4. Build Application

```bash
# Set required environment variables
export VITE_SUPABASE_URL=<staging-or-prod-url>
export VITE_SUPABASE_ANON_KEY=<staging-or-prod-key>

# Build web app
pnpm build

# Build agents service
cd agents-service && pnpm build
```

### 5. Run E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install --with-deps

# Run E2E tests against staging
PLAYWRIGHT_BASE_URL=https://staging.icupa.app pnpm test:e2e

# Generate HTML report
npx playwright show-report tests/playwright/artifacts/phase10/playwright/html
```

### 6. Run SQL Tests

```bash
# Requires Supabase CLI and local Supabase running
pnpm supabase:test
```

### 7. Security Scans

```bash
# Dependency audit
pnpm audit

# Check for high/critical vulnerabilities
pnpm audit --audit-level=high

# Secret scanning (in CI)
node tools/scripts/check-client-secrets.mjs
```

## Staging Deployment

### 1. Deploy Database Migrations

```bash
# Link to staging project
supabase link --project-ref <staging-project-ref>

# Review pending migrations
supabase db diff

# Apply migrations
supabase db push

# Verify migration success
supabase db remote list-migrations
```

### 2. Deploy Edge Functions

```bash
# Deploy all edge functions
./scripts/supabase/deploy-functions.sh --project <staging-project-ref>

# Or deploy specific function
supabase functions deploy <function-name> --project-ref <staging-project-ref>

# Verify deployment
curl https://<staging-project-ref>.functions.supabase.co/<function-name>/health
```

### 3. Update Secrets

```bash
# Set edge function secrets
supabase secrets set OPENAI_API_KEY=<staging-key> --project-ref <staging-project-ref>
supabase secrets set STRIPE_SECRET_KEY=<staging-key> --project-ref <staging-project-ref>

# Verify secrets (don't expose values)
supabase secrets list --project-ref <staging-project-ref>
```

### 4. Deploy Web Application

```bash
# Build with staging environment
export VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
export VITE_SUPABASE_ANON_KEY=<staging-anon-key>
pnpm build

# Deploy to Vercel/Netlify (via Git push or CLI)
# Example for Vercel:
vercel deploy --prod --token $VERCEL_TOKEN
```

### 5. Deploy Agents Service

```bash
# Build Docker image
cd agents-service
docker build -t icupa-agents-service:staging .

# Push to container registry
docker tag icupa-agents-service:staging <registry>/icupa-agents-service:staging
docker push <registry>/icupa-agents-service:staging

# Deploy to Cloud Run/ECS
# Example for Cloud Run:
gcloud run deploy icupa-agents-service \
  --image <registry>/icupa-agents-service:staging \
  --platform managed \
  --region <region> \
  --set-env-vars "SUPABASE_URL=https://<staging-project-ref>.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>"
```

### 6. Smoke Tests

```bash
# Run smoke tests against staging
BASE_URL=https://staging.icupa.app pnpm test:e2e --grep @smoke
```

## Production Deployment

### Pre-Production Checklist

- [ ] Staging deployment successful
- [ ] Smoke tests passed in staging
- [ ] Performance tests passed (if applicable)
- [ ] Security scan completed
- [ ] Rollback plan reviewed
- [ ] On-call engineer notified
- [ ] Change window scheduled (if applicable)
- [ ] Stakeholders notified

### 1. Database Migrations (Production)

```bash
# ⚠️ CRITICAL: Take database backup before migrations
# Supabase automatic backups enabled? Verify!

# Link to production project
supabase link --project-ref <prod-project-ref>

# Review migrations one final time
supabase db diff

# Apply migrations (monitor closely)
supabase db push

# Verify migration success
supabase db remote list-migrations

# Test critical queries
psql $DATABASE_URL -c "SELECT COUNT(*) FROM orders WHERE status = 'pending';"
```

### 2. Deploy Edge Functions (Production)

```bash
# Deploy to production
./scripts/supabase/deploy-functions.sh --project <prod-project-ref>

# Verify each function
for func in menu/ingest menu/embed_items payments/process; do
  curl -I https://<prod-project-ref>.functions.supabase.co/$func/health
done

# Update scheduler URLs if needed
./scripts/supabase/update-scheduler-url.sh \
  --project <prod-project-ref> \
  --url https://<prod-project-ref>.functions.supabase.co/menu/embed_items
```

### 3. Update Secrets (Production)

```bash
# Set production secrets
supabase secrets set OPENAI_API_KEY=<prod-key> --project-ref <prod-project-ref>
supabase secrets set STRIPE_SECRET_KEY=<prod-key> --project-ref <prod-project-ref>
supabase secrets set STRIPE_WEBHOOK_SECRET=<prod-secret> --project-ref <prod-project-ref>

# For Rwanda: Mobile Money credentials
supabase secrets set MOMO_API_KEY=<prod-key> --project-ref <prod-project-ref>
supabase secrets set AIRTEL_API_KEY=<prod-key> --project-ref <prod-project-ref>
```

### 4. Deploy Web Application (Production)

```bash
# Build with production environment
export VITE_SUPABASE_URL=https://<prod-project-ref>.supabase.co
export VITE_SUPABASE_ANON_KEY=<prod-anon-key>
export NODE_ENV=production
pnpm build

# Deploy (example for Vercel)
vercel deploy --prod

# Verify deployment
curl -I https://icupa.app
```

### 5. Deploy Agents Service (Production)

```bash
# Build and tag production image
cd agents-service
docker build -t icupa-agents-service:$(git rev-parse --short HEAD) .
docker tag icupa-agents-service:$(git rev-parse --short HEAD) <registry>/icupa-agents-service:latest
docker push <registry>/icupa-agents-service:latest

# Deploy with zero-downtime strategy
gcloud run deploy icupa-agents-service \
  --image <registry>/icupa-agents-service:latest \
  --platform managed \
  --region <region> \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --memory 4Gi \
  --set-env-vars "SUPABASE_URL=https://<prod-project-ref>.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>" \
  --set-env-vars "OPENAI_API_KEY=<prod-key>" \
  --no-traffic  # Deploy without sending traffic

# Gradually migrate traffic
gcloud run services update-traffic icupa-agents-service \
  --to-revisions=LATEST=10  # Start with 10%

# Monitor for 5-10 minutes, then increase
gcloud run services update-traffic icupa-agents-service \
  --to-revisions=LATEST=50

# Monitor again, then fully migrate
gcloud run services update-traffic icupa-agents-service \
  --to-revisions=LATEST=100
```

### 6. Enable Feature Flags (Gradual Rollout)

```bash
# Example: Enable AI waiter for 10% of sessions
# Update agent_runtime_configs table
psql $DATABASE_URL <<EOF
UPDATE agent_runtime_configs 
SET value = jsonb_set(value, '{rollout_percentage}', '10')
WHERE key = 'ai.waiter.enabled';
EOF

# Monitor metrics, then increase rollout
# 10% → 25% → 50% → 100% over several hours/days
```

## Post-Deployment Verification

### Automated Checks

```bash
# Run smoke tests against production
PLAYWRIGHT_BASE_URL=https://icupa.app pnpm test:e2e --grep @smoke

# Health check endpoints
curl https://icupa.app/health
curl https://<prod-project-ref>.functions.supabase.co/menu/ingest/health
curl https://agents-service-url.com/health
```

### Manual Verification

**Diner Experience:**
1. Scan QR code → verify menu loads
2. Browse menu → verify images and prices
3. Add items to cart → verify cart state
4. Interact with AI waiter → verify responses
5. Proceed to checkout → verify payment flow

**Merchant Portal:**
1. Login via WhatsApp OTP
2. View KDS → verify order display
3. Upload menu → verify ingestion
4. View analytics → verify data

**Admin Console:**
1. Login via magic link
2. View tenants → verify data
3. View AI metrics → verify telemetry
4. Test kill switches → verify controls

### Metrics to Monitor

```sql
-- Active sessions in last 5 minutes
SELECT COUNT(DISTINCT session_id) 
FROM sessions 
WHERE last_activity > NOW() - INTERVAL '5 minutes';

-- Orders created in last hour
SELECT COUNT(*) 
FROM orders 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Failed payments in last hour
SELECT COUNT(*) 
FROM payment_attempts 
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '1 hour';

-- AI agent errors in last hour
SELECT COUNT(*) 
FROM agent_events 
WHERE level = 'error' 
AND created_at > NOW() - INTERVAL '1 hour';
```

### Performance Baselines

Expected performance (P95):
- Menu load: < 2s
- Cart operations: < 500ms
- AI waiter response: < 5s
- Checkout flow: < 3s
- Payment confirmation: < 10s

Monitor using:
```bash
# Lighthouse performance audit
pnpm test:perf

# Custom performance monitoring
# Check src/lib/performance.ts for Web Vitals tracking
```

## Rollback Procedures

### Web Application Rollback

**Vercel/Netlify:**
```bash
# Rollback to previous deployment
vercel rollback <deployment-url>

# Or via dashboard: Deployments → Select previous → Promote to Production
```

### Agents Service Rollback

**Cloud Run:**
```bash
# List revisions
gcloud run revisions list --service icupa-agents-service

# Rollback to previous revision
gcloud run services update-traffic icupa-agents-service \
  --to-revisions=<previous-revision>=100
```

### Database Migration Rollback

```bash
# ⚠️ CRITICAL: Database rollbacks are risky
# Always prefer forward-fixing migrations

# If absolutely necessary, restore from backup:
# 1. Contact Supabase support or use dashboard
# 2. Restore to snapshot from before migration
# 3. Verify data integrity
# 4. Redeploy previous application version

# For minor issues, consider forward-fixing migration:
supabase migration new fix_previous_migration
# Edit the new migration to fix issues
supabase db push
```

### Edge Functions Rollback

```bash
# Redeploy previous version from Git
git checkout <previous-commit>
./scripts/supabase/deploy-functions.sh --project <prod-project-ref>
git checkout main
```

### Feature Flag Rollback

```sql
-- Disable feature immediately
UPDATE agent_runtime_configs 
SET value = jsonb_set(value, '{enabled}', 'false')
WHERE key = 'ai.waiter.enabled';

-- Or use kill switch endpoint
curl -X POST https://icupa.app/api/kill-switch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"feature": "ai.waiter", "enabled": false}'
```

### Rollback Decision Matrix

| Severity | Symptoms | Action |
|----------|----------|--------|
| **Critical** | Site down, data loss, security breach | Immediate full rollback + incident response |
| **High** | Major feature broken, payment failures | Rollback affected component + hotfix |
| **Medium** | Minor feature issues, degraded performance | Disable feature flag + scheduled fix |
| **Low** | UI glitch, non-critical bug | Forward fix in next deployment |

## Monitoring & Alerts

### Key Metrics to Watch

**Application Metrics:**
- Request rate (req/s)
- Error rate (%)
- Response time (P50, P95, P99)
- Availability (uptime %)

**Business Metrics:**
- Active sessions
- Orders per hour
- Successful payments
- AI waiter usage
- Menu views

**Infrastructure Metrics:**
- CPU usage (%)
- Memory usage (%)
- Database connections
- Storage usage (GB)

### Alert Thresholds

```yaml
alerts:
  - name: high_error_rate
    condition: error_rate > 5%
    window: 5m
    severity: critical
    
  - name: slow_response_time
    condition: p95_latency > 3s
    window: 10m
    severity: high
    
  - name: database_connection_pool_exhausted
    condition: db_connections > 80%
    window: 5m
    severity: high
    
  - name: payment_failure_spike
    condition: payment_failures > 10 in 5m
    window: 5m
    severity: critical
    
  - name: ai_agent_errors
    condition: agent_errors > 20 in 10m
    window: 10m
    severity: medium
```

### Monitoring Dashboards

1. **Application Health Dashboard**
   - Request rates by endpoint
   - Error rates by type
   - Response time distribution
   - Active users/sessions

2. **Business KPIs Dashboard**
   - Orders created (hourly/daily)
   - Revenue (hourly/daily)
   - Conversion rates
   - AI waiter engagement

3. **Infrastructure Dashboard**
   - Resource utilization
   - Database performance
   - Storage usage
   - Network traffic

### Logging Strategy

**Log Levels:**
- `ERROR`: Application errors, unhandled exceptions
- `WARN`: Degraded performance, retries, deprecated features
- `INFO`: Request/response, business events
- `DEBUG`: Detailed debugging (disabled in production)

**Log Format (JSON):**
```json
{
  "timestamp": "2025-10-29T18:00:00Z",
  "level": "INFO",
  "service": "agents-service",
  "trace_id": "abc123",
  "user_id": "user_xyz",
  "message": "AI waiter request processed",
  "duration_ms": 1234,
  "metadata": {
    "agent": "waiter",
    "tokens_used": 450
  }
}
```

**PII Scrubbing:**
- Never log passwords, tokens, or OTPs
- Redact PII (phone numbers, emails) in logs
- Use correlation IDs for debugging without exposing user data

## On-Call Handoff

### Handoff Checklist

- [ ] Review recent deployments and changes
- [ ] Check current alerts and incidents
- [ ] Review known issues and workarounds
- [ ] Verify monitoring dashboards are accessible
- [ ] Confirm access to production systems
- [ ] Review escalation procedures
- [ ] Share contact information

### On-Call Responsibilities

1. **Respond to alerts** within SLA:
   - Critical: 15 minutes
   - High: 30 minutes
   - Medium: 2 hours

2. **Monitor dashboards** regularly:
   - Check every 2 hours during business hours
   - On-call phone for critical alerts 24/7

3. **Incident management**:
   - Acknowledge alert
   - Assess severity
   - Mitigate (rollback, kill switch, scaling)
   - Document incident
   - Post-mortem for critical incidents

4. **Communicate**:
   - Update stakeholders on critical incidents
   - Document issues in incident log
   - Escalate if needed

### Escalation Path

1. **On-call engineer** (first responder)
2. **Tech lead** (if issue not resolved in 1 hour)
3. **Engineering manager** (for business impact)
4. **CTO** (for critical outages or security incidents)

### Contact Information

```yaml
on_call:
  primary: +XXX-XXX-XXXX
  backup: +XXX-XXX-XXXX

escalation:
  tech_lead: lead@icupa.app
  eng_manager: manager@icupa.app
  cto: cto@icupa.app

external_vendors:
  supabase_support: support@supabase.com
  openai_support: support@openai.com
  payment_support: support@stripe.com
```

## Common Issues & Resolutions

### Issue: High Database Connection Count

**Symptoms:**
- Errors: "too many connections"
- Slow queries
- Timeouts

**Resolution:**
```bash
# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
psql $DATABASE_URL -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';
"

# Long-term: Increase connection pool size or enable connection pooling
```

### Issue: AI Agent Timeouts

**Symptoms:**
- AI waiter not responding
- Timeout errors
- High latency

**Resolution:**
```bash
# Check OpenAI API status
curl https://status.openai.com/api/v2/status.json

# Check agent service logs
gcloud logging read "resource.type=cloud_run_revision AND severity=ERROR" --limit 50

# If OpenAI is down, enable AI kill switch
curl -X POST https://icupa.app/api/kill-switch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"feature": "ai.waiter", "enabled": false}'
```

### Issue: Payment Failures

**Symptoms:**
- Payment confirmation not received
- Orders stuck in "pending" state

**Resolution:**
```bash
# Check payment provider status
curl https://status.stripe.com/api/v2/status.json

# Verify webhook endpoint is accessible
curl -I https://<prod-project-ref>.functions.supabase.co/payments/webhook

# Check webhook secrets are correct
supabase secrets list --project-ref <prod-project-ref>

# Manually reconcile payment (if needed)
psql $DATABASE_URL -c "
UPDATE orders 
SET status = 'completed', payment_status = 'paid'
WHERE id = '<order-id>' AND payment_confirmed_externally = true;
"
```

### Issue: Menu Not Loading

**Symptoms:**
- Blank menu screen
- 404 errors for menu endpoint

**Resolution:**
```bash
# Check if embeddings are stale
psql $DATABASE_URL -c "
SELECT MAX(updated_at) FROM menu_embeddings;
"

# Trigger manual embedding refresh
curl -X POST https://<prod-project-ref>.functions.supabase.co/menu/embed_items \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Check RLS policies
psql $DATABASE_URL -c "
SELECT * FROM pg_policies WHERE tablename = 'menu_items';
"
```

### Issue: High Memory Usage (Agents Service)

**Symptoms:**
- OOM errors
- Container restarts
- Slow response times

**Resolution:**
```bash
# Check memory usage
gcloud run services describe icupa-agents-service --format="value(status.url)"

# Increase memory allocation
gcloud run services update icupa-agents-service --memory 8Gi

# Check for memory leaks in logs
gcloud logging read "resource.type=cloud_run_revision AND textPayload:'heap'" --limit 100

# Scale out instead of up (if applicable)
gcloud run services update icupa-agents-service --max-instances 20
```

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Security Policy](../SECURITY.md)
- [Backend Contract](./backend-contract.md)
- [Observability Guide](./observability.md)
- [Testing Guide](./testing.md)
- [Go-Live Runbook](./runbooks/go-live.md) (original)

---

**Last Updated**: 2025-10-29  
**Maintained By**: @ikanisa/devops
**Review Frequency**: After each major release or quarterly
