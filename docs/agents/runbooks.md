# AI Agents Runbooks

Operational procedures for the AI agents infrastructure.

## Table of Contents

- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Incident Response](#incident-response)
- [Maintenance](#maintenance)

## Common Tasks

### Restart Agents Service

```bash
# Stop service
pm2 stop ai-agents

# Start service
pm2 start ai-agents

# Check logs
pm2 logs ai-agents
```

### Check System Health

```bash
# Health check
curl https://your-domain.com/api/health

# Check logs
tail -f /var/log/ai-agents/app.log | grep ERROR

# Check metrics
curl https://your-domain.com/api/metrics
```

### Verify WhatsApp Integration

```bash
# Test webhook verification
curl "https://your-domain.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=TEST"

# Should return: TEST
```

### Check Database Connections

```bash
# Connect to Supabase
psql $SUPABASE_URL

# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';

# Check slow queries
SELECT query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

### Rotate API Keys

1. Generate new OpenAI API key in OpenAI dashboard
2. Update environment variable:
   ```bash
   export OPENAI_API_KEY=new-key
   ```
3. Restart service
4. Verify working:
   ```bash
   curl https://your-domain.com/api/health
   ```
5. Revoke old key in OpenAI dashboard

## Troubleshooting

### WhatsApp Messages Not Being Received

**Symptoms:**
- Messages sent to bot not getting responses
- Webhook not receiving events

**Investigation:**
1. Check webhook is verified:
   ```bash
   curl "https://your-domain.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=TEST"
   ```

2. Check Meta Developer Console webhook logs

3. Check application logs:
   ```bash
   grep "whatsapp" /var/log/ai-agents/app.log
   ```

4. Check webhook URL is accessible:
   ```bash
   curl -I https://your-domain.com/api/whatsapp/webhook
   ```

**Resolution:**
- Re-verify webhook in Meta Developer Console
- Check firewall/security rules
- Verify SSL certificate is valid
- Restart service if needed

### Tool Calls Failing

**Symptoms:**
- Agent responds with errors
- "Unable to complete request" messages

**Investigation:**
1. Check Supabase connection:
   ```bash
   psql $SUPABASE_URL -c "SELECT 1"
   ```

2. Check function logs:
   ```bash
   grep "tool_call" /var/log/ai-agents/app.log | tail -20
   ```

3. Test tool directly:
   ```bash
   curl -X POST https://your-domain.com/api/tools/lookup_customer \
     -H "Content-Type: application/json" \
     -d '{"msisdn": "+250788123456"}'
   ```

**Resolution:**
- Check database is accessible
- Verify service role key is valid
- Check table permissions
- Review error messages in logs

### High Latency

**Symptoms:**
- Responses taking > 5s
- Timeout errors

**Investigation:**
1. Check database query performance:
   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. Check OpenAI API latency:
   ```bash
   grep "openai_latency" /var/log/ai-agents/app.log | tail -20
   ```

3. Check system resources:
   ```bash
   top
   free -h
   df -h
   ```

**Resolution:**
- Add database indexes if queries are slow
- Scale up if CPU/memory constrained
- Check OpenAI API status page
- Enable caching if appropriate

### Memory Leak

**Symptoms:**
- Memory usage growing over time
- Out of memory errors

**Investigation:**
1. Check memory usage:
   ```bash
   ps aux | grep node
   free -h
   ```

2. Generate heap snapshot (Node.js):
   ```bash
   kill -USR2 <pid>
   ```

3. Analyze heap snapshot with Chrome DevTools

**Resolution:**
- Identify leaking objects
- Fix code and redeploy
- Restart service as temporary fix
- Set up memory alerts

## Incident Response

### P0: Complete Service Outage

**Response Time:** Immediate

**Actions:**
1. **Notify:**
   - Post in #incidents Slack channel
   - Page on-call engineer
   - Update status page

2. **Mitigate:**
   - Disable all features:
     ```bash
     export AI_REALTIME_ENABLED=false
     export AI_RESPONSES_ENABLED=false
     export WHATSAPP_INTEGRATION_ENABLED=false
     pm2 restart ai-agents
     ```

3. **Investigate:**
   - Check logs: `tail -f /var/log/ai-agents/app.log`
   - Check health: `curl https://your-domain.com/api/health`
   - Check dependencies: Database, OpenAI API, etc.

4. **Resolve:**
   - Fix root cause
   - Test fix in staging
   - Deploy to production
   - Re-enable features gradually
   - Monitor closely

5. **Communicate:**
   - Update status page
   - Notify stakeholders
   - Post-mortem scheduled

### P1: Degraded Performance

**Response Time:** 15 minutes

**Actions:**
1. **Notify:**
   - Post in #engineering Slack channel
   - Alert on-call engineer

2. **Investigate:**
   - Check metrics dashboard
   - Review recent deployments
   - Check error logs

3. **Mitigate:**
   - Scale up resources if needed
   - Disable non-critical features
   - Add rate limiting

4. **Resolve:**
   - Implement fix
   - Deploy to production
   - Monitor recovery

### P2: Non-critical Issues

**Response Time:** 1 hour

**Actions:**
1. Create issue in issue tracker
2. Investigate during business hours
3. Fix in next deployment

## Maintenance

### Weekly Tasks

- [ ] Review error logs
- [ ] Check disk space
- [ ] Review performance metrics
- [ ] Check for dependency updates
- [ ] Review eval results

### Monthly Tasks

- [ ] Review and rotate API keys
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review and archive old logs
- [ ] Update dependencies
- [ ] Review and optimize database indexes
- [ ] Capacity planning review

### Quarterly Tasks

- [ ] Security audit
- [ ] Disaster recovery test
- [ ] Performance optimization review
- [ ] Cost optimization review
- [ ] Update runbooks

### Database Maintenance

```bash
# Vacuum and analyze
psql $SUPABASE_URL -c "VACUUM ANALYZE vouchers;"
psql $SUPABASE_URL -c "VACUUM ANALYZE customers;"

# Check table sizes
psql $SUPABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check index usage
psql $SUPABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
"
```

### Log Rotation

```bash
# Rotate logs
logrotate -f /etc/logrotate.d/ai-agents

# Compress old logs
find /var/log/ai-agents -name "*.log.*" -mtime +7 -exec gzip {} \;

# Delete old logs (>30 days)
find /var/log/ai-agents -name "*.gz" -mtime +30 -delete
```

### Backup and Recovery

```bash
# Backup database
pg_dump $SUPABASE_URL > backup-$(date +%Y%m%d).sql

# Restore database
psql $SUPABASE_URL < backup-20251030.sql

# Verify restore
psql $SUPABASE_URL -c "SELECT count(*) FROM vouchers;"
```

## Monitoring Dashboards

### Key Dashboards

1. **Service Health**: https://monitoring.icupa.dev/ai-agents
2. **Error Rate**: https://monitoring.icupa.dev/ai-agents/errors
3. **Latency**: https://monitoring.icupa.dev/ai-agents/latency
4. **Database**: https://monitoring.icupa.dev/ai-agents/database

### Key Metrics

- Request rate (req/s)
- Error rate (%)
- Latency p50, p95, p99 (ms)
- Tool call success rate (%)
- Database connection pool usage
- Memory usage (MB)
- CPU usage (%)

## Contact Information

- **On-call Engineer**: #oncall Slack channel
- **Engineering Lead**: engineering-lead@icupa.dev
- **DevOps Team**: devops@icupa.dev
- **Support Team**: support@icupa.dev

## References

- [Architecture Documentation](./README.md)
- [Migration Guide](./migration.md)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI Documentation](https://platform.openai.com/docs)
