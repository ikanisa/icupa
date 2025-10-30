# AI Agents Migration Guide

This document describes how to safely deploy and roll back the AI agents infrastructure.

## Pre-deployment Checklist

- [ ] All environment variables configured in production
- [ ] Database tables created (customers, vouchers)
- [ ] WhatsApp webhook verified
- [ ] OpenAI API key tested
- [ ] Feature flags set appropriately
- [ ] Monitoring/alerting configured
- [ ] Rollback plan reviewed

## Deployment Strategy

### Phase 1: Infrastructure (Week 1)

**Deploy:**
1. Database tables and indexes
2. Environment variables
3. Feature flags (all disabled)

**Verify:**
- Database migrations successful
- No errors in logs
- Health check passing

**Rollback:**
- Feature flags already disabled
- No user-facing changes yet

### Phase 2: Core Components (Week 2)

**Deploy:**
1. Supabase functions (lookup_customer, create_voucher, etc.)
2. Tool router and response handler
3. Logging and telemetry

**Enable flags:**
```bash
VOUCHER_CREATION_ENABLED=true
TELEMETRY_ENABLED=true
```

**Verify:**
- Tool calls working in test environment
- Logs showing structured output
- PII redaction working

**Rollback:**
```bash
VOUCHER_CREATION_ENABLED=false
TELEMETRY_ENABLED=false
```

### Phase 3: WhatsApp Integration (Week 3)

**Deploy:**
1. WhatsApp webhook handler
2. Message sender
3. Idempotency cache

**Enable flags:**
```bash
WHATSAPP_INTEGRATION_ENABLED=true
AI_RESPONSES_ENABLED=true
```

**Verify:**
- Webhook verification successful
- Test messages processed correctly
- Responses sent successfully
- No duplicate message processing

**Rollback:**
```bash
WHATSAPP_INTEGRATION_ENABLED=false
AI_RESPONSES_ENABLED=false
```

### Phase 4: Realtime Voice (Week 4)

**Deploy:**
1. SIP session handler
2. Realtime webhook
3. Tool bridge

**Enable flags:**
```bash
AI_REALTIME_ENABLED=true
```

**Verify:**
- SIP sessions starting successfully
- Tool callbacks working
- Audio quality acceptable
- Latency within targets

**Rollback:**
```bash
AI_REALTIME_ENABLED=false
```

### Phase 5: Full Rollout (Week 5+)

**Deploy:**
1. Evals in CI
2. Production monitoring
3. Gradual user rollout

**Enable all flags:**
```bash
AI_REALTIME_ENABLED=true
AI_RESPONSES_ENABLED=true
WHATSAPP_INTEGRATION_ENABLED=true
VOUCHER_CREATION_ENABLED=true
VOUCHER_REDEMPTION_ENABLED=true
TELEMETRY_ENABLED=true
```

## Rollback Procedures

### Immediate Rollback (P0 Incident)

If critical issues occur:

1. **Disable all features immediately:**
   ```bash
   AI_REALTIME_ENABLED=false
   AI_RESPONSES_ENABLED=false
   WHATSAPP_INTEGRATION_ENABLED=false
   ```

2. **Notify stakeholders:**
   - Engineering team
   - Product team
   - Support team

3. **Investigate:**
   - Check logs for errors
   - Check metrics/dashboards
   - Identify root cause

4. **Fix forward or roll back:**
   - Hot fix if possible
   - Otherwise, revert deployment

### Gradual Rollback (P1/P2 Issues)

If non-critical issues occur:

1. **Reduce scope:**
   - Disable specific features
   - Reduce traffic percentage
   - Limit to test users only

2. **Monitor:**
   - Watch error rates
   - Check user feedback
   - Verify fix working

3. **Decide:**
   - Continue with reduced scope
   - Fix and re-enable
   - Full rollback if needed

## Data Migration

### Vouchers Table

If vouchers table needs changes:

1. **Create migration:**
   ```sql
   -- Add new column
   ALTER TABLE vouchers ADD COLUMN new_field TEXT;
   
   -- Backfill data
   UPDATE vouchers SET new_field = 'default_value' WHERE new_field IS NULL;
   ```

2. **Deploy migration:**
   - Run in staging first
   - Verify data integrity
   - Run in production with read replicas

3. **Rollback if needed:**
   ```sql
   -- Remove column
   ALTER TABLE vouchers DROP COLUMN new_field;
   ```

### Customers Table

Similar process as vouchers table.

## Monitoring

### Key Metrics

Monitor these metrics during deployment:

- **Error rate**: Should be < 1%
- **Latency p95**: Should be < 2.5s for tools, < 800ms for voice
- **Tool call success rate**: Should be > 99%
- **WhatsApp delivery rate**: Should be > 98%
- **Voice session success rate**: Should be > 95%

### Alerts

Set up alerts for:

- Error rate > 5%
- Latency p95 > 5s
- Tool call failures > 50/hour
- Health check failing
- Database connection errors

## Testing Strategy

### Pre-deployment Testing

1. **Unit tests**: All passing
2. **Integration tests**: Key flows working
3. **Evals**: Pass rate > 95%
4. **Load tests**: System handles expected load
5. **Security scan**: No vulnerabilities

### Post-deployment Testing

1. **Smoke tests**: Basic flows working
2. **Canary testing**: Small percentage of users
3. **A/B testing**: Compare with previous version
4. **User feedback**: Monitor support tickets

## Rollback Decision Matrix

| Severity | Error Rate | Response Time | Action |
|----------|-----------|---------------|--------|
| P0 | > 50% | Any | Immediate rollback |
| P0 | Any | > 30s | Immediate rollback |
| P1 | > 10% | > 10s | Gradual rollback |
| P2 | > 5% | > 5s | Monitor, prepare rollback |
| P3 | < 5% | < 5s | Monitor only |

## Communication Plan

### Internal Communication

- **Slack channels**: #engineering, #product, #support
- **Email**: engineering@icupa.dev
- **Status page**: status.icupa.dev

### External Communication

- **User notification**: Via WhatsApp/SMS
- **Status page update**: Public status page
- **Support KB**: Update help articles

## Lessons Learned

After each deployment or rollback, conduct a retrospective:

1. What went well?
2. What could be improved?
3. What surprised us?
4. What actions should we take?

Document findings and update this guide.

## References

- [Deployment Runbook](./runbooks.md)
- [Architecture Documentation](./README.md)
- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
