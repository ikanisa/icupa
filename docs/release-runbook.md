# Release Runbook - ICUPA Platform

**Version:** 1.0  
**Last Updated:** 2025-10-29  
**Owner:** Operations/SRE Team  

---

## Overview

This runbook documents the standard operating procedures for deploying ICUPA to staging and production environments. It covers build validation, deployment steps, smoke testing, rollback procedures, and on-call handoff.

---

## Release Checklist

### Pre-Release (1 Week Before)
- [ ] Review and triage all S0/S1 issues
- [ ] Verify all critical tests pass
- [ ] Update CHANGELOG.md with release notes
- [ ] Tag release in Git: `vX.Y.Z`
- [ ] Generate SBOM artifacts
- [ ] Run security scan (CodeQL, dependency audit)
- [ ] Review performance metrics from staging
- [ ] Notify stakeholders of release window

### Release Day
- [ ] Verify CI passes on release branch
- [ ] Deploy to staging
- [ ] Run smoke tests on staging
- [ ] Load test staging (if major changes)
- [ ] Get approval from Product/Engineering leads
- [ ] Deploy to production
- [ ] Run smoke tests on production
- [ ] Monitor error rates and latency (1 hour)
- [ ] Update status page
- [ ] Send release notification

### Post-Release
- [ ] Monitor alerts for 24 hours
- [ ] Review error logs
- [ ] Update documentation if needed
- [ ] Close release issues
- [ ] Retrospective (if issues occurred)

---

## Build & Test Pipeline

### 1. Local Validation (Developer)

```bash
# Install dependencies
pnpm install

# Run linter
pnpm lint

# Run type checker
pnpm typecheck

# Run unit tests
pnpm test

# Run E2E tests (optional for developers)
pnpm test:e2e

# Build for production
VITE_SUPABASE_URL=<staging-url> \
VITE_SUPABASE_ANON_KEY=<staging-key> \
pnpm build
```

### 2. CI Validation (Automated)

CI runs on all PRs and commits to `main`:
- **Lint:** ESLint with max-warnings=0
- **Type Check:** TypeScript compilation
- **Build:** Production bundle with staging env vars
- **Tests:** Vitest unit tests
- **Coverage:** (After implementation) Minimum 80% threshold
- **Secret Scan:** Check for leaked credentials
- **SBOM:** (After implementation) Generate artifacts

### 3. Security Validation

```bash
# Dependency audit
pnpm audit

# Update vulnerable dependencies
pnpm update <package>

# Verify no high-severity CVEs remain
pnpm audit --audit-level=high
```

---

## Deployment Procedures

### Architecture Components

1. **Web PWA** - Static bundle (Vercel/Netlify/CDN)
2. **Agents Service** - Containerized (Docker/K8s)
3. **Supabase Edge Functions** - Deno runtime
4. **Database Migrations** - PostgreSQL

### Staging Deployment

#### A. Deploy Database Migrations

```bash
# Connect to Supabase
export SUPABASE_ACCESS_TOKEN=<staging-token>
supabase login

# Link to staging project
supabase link --project-ref <staging-ref>

# Review pending migrations
supabase db diff

# Apply migrations
supabase db push

# Run SQL tests
supabase db test
```

#### B. Deploy Edge Functions

```bash
# Deploy all functions (no JWT verification for staging)
./scripts/supabase/deploy-functions.sh --project <staging-ref>

# Or deploy specific function
supabase functions deploy payments --project-ref <staging-ref> --no-verify-jwt
```

#### C. Deploy Agents Service

```bash
# Build Docker image
cd agents-service
docker build -t icupa-agents:staging .

# Push to registry
docker tag icupa-agents:staging <registry>/icupa-agents:staging
docker push <registry>/icupa-agents:staging

# Deploy to staging K8s/Cloud Run
kubectl apply -f infrastructure/k8s/agents-service/staging.yaml
# OR
gcloud run deploy agents-service --image=<registry>/icupa-agents:staging
```

#### D. Deploy Web PWA

```bash
# Build production bundle
VITE_SUPABASE_URL=<staging-url> \
VITE_SUPABASE_ANON_KEY=<staging-key> \
pnpm build

# Deploy to Vercel (automatic via Git push)
git push origin main

# OR deploy to CDN
aws s3 sync dist/ s3://icupa-staging-web/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

### Production Deployment

**IMPORTANT:** Production deploys require approval from Engineering Lead and Product Owner.

#### Pre-Production Checklist
- [ ] Staging deployment successful
- [ ] Smoke tests pass on staging
- [ ] No S0/S1 issues open
- [ ] Deployment window scheduled (low-traffic period)
- [ ] On-call engineer assigned and notified
- [ ] Rollback plan reviewed

#### Production Deploy Steps

**Same as staging, but with production credentials:**

1. **Database Migrations** (10 minutes)
   ```bash
   supabase link --project-ref <prod-ref>
   supabase db push
   supabase db test
   ```

2. **Edge Functions** (15 minutes)
   ```bash
   ./scripts/supabase/deploy-functions.sh --project <prod-ref> --verify-jwt
   ```

3. **Agents Service** (10 minutes)
   ```bash
   docker build -t icupa-agents:vX.Y.Z .
   docker push <registry>/icupa-agents:vX.Y.Z
   kubectl apply -f infrastructure/k8s/agents-service/production.yaml
   ```

4. **Web PWA** (5 minutes)
   ```bash
   VITE_SUPABASE_URL=<prod-url> \
   VITE_SUPABASE_ANON_KEY=<prod-key> \
   pnpm build
   # Deploy via Vercel or CDN sync
   ```

**Total Deployment Time:** ~40 minutes

---

## Smoke Tests

### Automated Smoke Tests

Run after each deployment:

```bash
# Set base URL
export BASE_URL=https://staging.icupa.app  # or production

# Health checks
./scripts/ops/health-check.sh

# Playwright critical path tests
PLAYWRIGHT_BASE_URL=$BASE_URL pnpm test:e2e --grep "@smoke"
```

### Manual Smoke Tests

#### 1. Web PWA (5 minutes)
- [ ] Navigate to homepage
- [ ] Scan QR code (use test table session)
- [ ] Browse menu
- [ ] Add item to cart
- [ ] Proceed to checkout
- [ ] Verify payment screen loads
- [ ] Check allergen warnings display

#### 2. Agents Service (3 minutes)
- [ ] Hit health endpoint: `curl https://<agents-url>/health`
- [ ] Test waiter agent: `POST /agents/waiter` with sample message
- [ ] Verify response contains grounded reply
- [ ] Check agent telemetry logged in database

#### 3. Edge Functions (5 minutes)
- [ ] Test table session creation
- [ ] Test payment checkout (Stripe test card)
- [ ] Test receipt generation (should queue)
- [ ] Verify webhook endpoints return 200

#### 4. Database (2 minutes)
- [ ] Run query: `SELECT COUNT(*) FROM auth.users;`
- [ ] Check RLS policies: `SELECT COUNT(*) FROM items WHERE tenant_id = '<test>';`
- [ ] Verify pg_cron jobs: `SELECT * FROM cron.job;`

---

## Monitoring & Validation

### Key Metrics to Watch (First Hour)

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| Error Rate | >2% | Investigate logs, consider rollback |
| Response Time (p95) | >5s | Check database, edge function logs |
| Payment Success Rate | <98% | Check Stripe, payment logs |
| Receipt Generation | >10s p95 | Check fiscalization queue |
| Agent Hallucination | >1% | Kill switch agent, review prompts |
| Database CPU | >80% | Scale up, check slow queries |
| Container Restarts | >3 in 10min | Check logs, rollback if unstable |

### Monitoring Dashboards

1. **Service Health Dashboard**
   - HTTP request rate
   - Error rate by endpoint
   - Response time (p50, p95, p99)
   - Success rate by service

2. **Business Metrics Dashboard**
   - Orders created per minute
   - Payment conversion rate
   - Average order value
   - Receipt generation latency

3. **Database Dashboard**
   - Connection pool usage
   - Query latency
   - Table sizes
   - Replication lag (if applicable)

### Log Analysis

```bash
# Check recent errors (last 5 minutes)
# For agents service:
kubectl logs deployment/agents-service --since=5m | grep ERROR

# For Edge Functions (via Supabase dashboard):
# Logs → Functions → Select function → Filter by level=ERROR

# For Web PWA (client errors):
# Check Sentry/LogRocket or browser console
```

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:
- Error rate >5% sustained for >5 minutes
- Payment success rate drops below 90%
- Critical functionality broken (unable to place orders)
- Security vulnerability introduced
- Database corruption detected

### Rollback Steps

#### 1. Web PWA Rollback (2 minutes)

```bash
# Vercel: Revert to previous deployment
vercel rollback <previous-deployment-url>

# OR CDN: Sync previous version
aws s3 sync s3://icupa-backups/web-vX.Y.Z-1/ s3://icupa-prod-web/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

#### 2. Agents Service Rollback (5 minutes)

```bash
# Kubernetes: Roll back to previous deployment
kubectl rollout undo deployment/agents-service

# Verify rollback
kubectl rollout status deployment/agents-service

# OR manually deploy previous version
kubectl set image deployment/agents-service agents=<registry>/icupa-agents:vX.Y.Z-1
```

#### 3. Edge Functions Rollback (10 minutes)

**Note:** Supabase doesn't support automatic function versioning. Manual redeployment required.

```bash
# Checkout previous release tag
git checkout vX.Y.Z-1

# Redeploy functions
./scripts/supabase/deploy-functions.sh --project <prod-ref> --verify-jwt

# Return to current branch
git checkout main
```

#### 4. Database Rollback (15-30 minutes)

**CAUTION:** Database rollbacks are risky. Only rollback if data corruption occurred.

```bash
# Connect to production
supabase link --project-ref <prod-ref>

# Review rollback migration
cat supabase/migrations/YYYYMMDD_<migration>.down.sql

# Apply rollback (ONLY if safe)
supabase migration repair <migration-id>

# OR restore from backup if data loss
supabase db dump --file=backup.sql
# Contact Supabase support for backup restoration
```

**Alternative:** For critical issues, consider:
- **Roll Forward:** Fix issue in hotfix and deploy
- **Feature Flag:** Disable problematic feature without full rollback
- **Agent Kill Switch:** Disable AI features if agents misbehaving

---

## Communication & Handoff

### Deployment Notification Template

**Slack/Email:**

```
🚀 ICUPA Production Deployment - vX.Y.Z

Status: ✅ Successful | ⚠️ Monitoring | ❌ Rolled Back

Changes:
- Feature A: Description
- Fix B: Description
- Update C: Description

Smoke Tests: ✅ Passed
Error Rate: 0.5% (normal)
Response Time: 1.2s p95 (good)

Next Steps:
- Monitor for 1 hour
- On-call: @engineer-name
- Rollback plan: Ready

Documentation: https://github.com/ikanisa/icupa/releases/tag/vX.Y.Z
```

### On-Call Handoff

**Context for On-Call Engineer:**

1. **What Was Deployed:**
   - Version: vX.Y.Z
   - Components: Web, Agents, Edge Functions, Database
   - Major Changes: [List features/fixes]

2. **Known Issues:**
   - [List any expected issues or warnings]
   - [Workarounds or mitigations]

3. **Monitoring:**
   - Primary Dashboard: [Link]
   - Alert Channels: #icupa-alerts
   - Escalation: @engineering-lead

4. **Rollback Decision Tree:**
   - If error rate >5%: Rollback immediately
   - If payment issues: Contact Stripe support first
   - If agent issues: Use kill switch, then investigate

5. **Key Contacts:**
   - Engineering Lead: [Name/Phone]
   - Product Owner: [Name/Phone]
   - Supabase Support: support@supabase.io
   - Stripe Support: [Support link]

---

## Incident Response

### Severity Levels

- **P0 (Critical):** Service down, payments failing, data loss
- **P1 (High):** Degraded performance, some features broken
- **P2 (Medium):** Minor bugs, non-critical features affected
- **P3 (Low):** Cosmetic issues, no user impact

### Response Times

| Severity | Response Time | Resolution Target |
|----------|---------------|-------------------|
| P0 | 5 minutes | 1 hour |
| P1 | 15 minutes | 4 hours |
| P2 | 1 hour | 24 hours |
| P3 | 24 hours | 1 week |

### Escalation Path

1. **On-Call Engineer** (first responder)
   - Assess severity
   - Attempt mitigation
   - Update status page

2. **Engineering Lead** (if not resolved in 30min)
   - Coordinate team response
   - Make rollback decision
   - Communicate with stakeholders

3. **CTO/VP Engineering** (if P0 >1 hour)
   - Executive escalation
   - External communication
   - Post-mortem planning

---

## Post-Deployment Review

### Success Criteria

- [ ] All smoke tests passed
- [ ] Error rate <1% for 24 hours
- [ ] No rollback required
- [ ] Performance metrics within SLOs
- [ ] No critical bugs reported
- [ ] Monitoring alerts functioning

### Post-Mortem (If Issues Occurred)

Conduct within 48 hours of incident:

1. **Timeline:** What happened and when?
2. **Root Cause:** Why did it happen?
3. **Impact:** Who was affected? How many users?
4. **Response:** What actions were taken?
5. **Lessons Learned:** What worked well? What didn't?
6. **Action Items:** How do we prevent this?

**Document in:** `docs/postmortems/YYYY-MM-DD-<incident>.md`

---

## Useful Commands Reference

### Supabase

```bash
# Login
supabase login

# Link project
supabase link --project-ref <ref>

# Check status
supabase status

# View logs
supabase functions logs <function-name>

# Database migrations
supabase db push
supabase db reset
supabase db test

# Secrets management
supabase secrets list
supabase secrets set KEY=value
```

### Docker/Kubernetes

```bash
# Build and tag
docker build -t icupa-agents:vX.Y.Z .
docker tag icupa-agents:vX.Y.Z <registry>/icupa-agents:vX.Y.Z

# Deploy
kubectl apply -f infrastructure/k8s/agents-service/production.yaml
kubectl rollout status deployment/agents-service

# Rollback
kubectl rollout undo deployment/agents-service

# Logs
kubectl logs deployment/agents-service --tail=100 -f
```

### pnpm

```bash
# Install
pnpm install

# Lint and type check
pnpm lint
pnpm typecheck

# Test
pnpm test
pnpm test:e2e

# Build
pnpm build
```

---

## Appendix

### A. Environment Variables

**Staging:**
- `VITE_SUPABASE_URL`: https://staging-<ref>.supabase.co
- `VITE_SUPABASE_ANON_KEY`: <staging-anon-key>
- `AGENTS_BASE_URL`: https://staging-agents.icupa.app

**Production:**
- `VITE_SUPABASE_URL`: https://<prod-ref>.supabase.co
- `VITE_SUPABASE_ANON_KEY`: <prod-anon-key>
- `AGENTS_BASE_URL`: https://agents.icupa.app

### B. Deployment Schedule

Recommended deployment windows:
- **Staging:** Anytime (low risk)
- **Production:** Tuesday/Wednesday, 10:00-14:00 UTC (low-traffic hours for Rwanda/Malta)
- **Avoid:** Fridays (weekend incident risk), Mondays (high traffic)

### C. Useful Links

- **GitHub Repo:** https://github.com/ikanisa/icupa
- **Supabase Dashboard:** https://supabase.com/dashboard/project/<ref>
- **Monitoring:** [Add monitoring URL]
- **Status Page:** [Add status page URL]
- **Documentation:** https://github.com/ikanisa/icupa/tree/main/docs

---

**Document Version:** 1.0  
**Next Review:** After first 3 production deployments  
**Maintained By:** Operations Team
