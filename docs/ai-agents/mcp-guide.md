# MCP Guide: AI Agents with Supabase Remote Control Plane

**Version:** 1.0  
**Last Updated:** 2025-10-29  
**Status:** ✅ Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [Agent Roles & Permissions](#agent-roles--permissions)
5. [Tool Manifests](#tool-manifests)
6. [Local Development](#local-development)
7. [Security & Compliance](#security--compliance)
8. [Operations & Monitoring](#operations--monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Runbooks](#runbooks)

---

## Overview

ICUPA uses **Supabase Remote MCP (Model Context Protocol)** as a shared control plane for AI agents. Three specialized agents operate with least-privilege access:

- **Waiter Agent** 🍽️ - Reads menus, creates orders, manages payments
- **CFO Agent** 💰 - Manages ledgers, invoices, journals (with approval workflow)
- **Legal Agent** ⚖️ - Handles cases, filings, documents, deadlines

### Key Benefits

- ✅ **Least-Privilege**: Each agent has minimal database permissions via dedicated PostgreSQL roles
- ✅ **Row-Level Security**: Data scoped by venue, user, or other context (no cross-contamination)
- ✅ **Audit Trail**: Every operation logged to `mcp_audit_log` with parameters and results
- ✅ **Human-in-the-Loop**: High-risk operations require approval before execution
- ✅ **Parameterized SQL**: All queries use safe `:param` syntax (no SQL injection)
- ✅ **Emergency Revocation**: Instant agent shutdown via role drops or RLS updates

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AI Chat Interfaces                         │
│         (ChatGPT, Claude, Cursor, Custom Apps)              │
└─────────────────────┬───────────────────────────────────────┘
                      │ OAuth2 Authentication
                      │ Tool Manifests (JSON)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Remote MCP Server                      │
│  (Remote URL: https://your-project.supabase.co/mcp)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌───────────┐
│ waiter_agent │ │ cfo_agent│ │legal_agent│
│ (Role)       │ │ (Role)   │ │ (Role)    │
└──────┬───────┘ └────┬─────┘ └─────┬─────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Supabase)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  menus   │  │gl_entries│  │  cases   │                  │
│  │  orders  │  │ invoices │  │ filings  │                  │
│  │ payments │  │tax_rules │  │doc_store │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │       mcp_audit_log (all agents)         │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup & Configuration

### Prerequisites

- **Node.js** 18.18.2+ (see `.nvmrc`)
- **pnpm** 10.x
- **Supabase CLI** 1.x (`npm i -g supabase`)
- **Docker** (for local Supabase)

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone https://github.com/ikanisa/icupa.git
   cd icupa
   pnpm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in MCP-specific variables:
   ```env
   # Remote MCP (production)
   SUPABASE_MCP_REMOTE_URL=https://your-project.supabase.co/mcp
   SUPABASE_MCP_OAUTH_CLIENT_ID=your-oauth-client-id
   SUPABASE_MCP_OAUTH_CLIENT_SECRET=your-oauth-secret
   
   # Local MCP (development)
   SUPABASE_MCP_LOCAL_URL=http://localhost:54321/mcp
   ```

3. **Start Local Supabase**
   ```bash
   pnpm supabase:start
   ```
   
   This starts:
   - PostgreSQL (port 54322)
   - Studio (port 54323)
   - API (port 54321)

4. **Apply MCP Migration**
   ```bash
   pnpm supabase:migrate
   ```
   
   This creates:
   - Agent roles (waiter_agent, cfo_agent, legal_agent)
   - Tables (menus, orders, gl_entries, cases, etc.)
   - RLS policies
   - Audit log

5. **Verify Setup**
   ```bash
   pnpm test:mcp
   pnpm security:lint-mcp
   ```

---

## Agent Roles & Permissions

### Waiter Agent 🍽️

**Purpose:** Manage in-venue ordering (Rwanda/Malta locations)

**Grants:**
- `SELECT, INSERT, UPDATE` on `menus`, `orders`, `payments_pending`

**RLS Scope:**
- Limited to `venue_id` set via `current_setting('app.venue_id')`
- Cannot see orders from other venues

**Example Tools:**
- `read_menu` - Get active menu items
- `create_order` - Place order for table
- `update_payment_status` - Mark payment completed

**Sample Config:** `mcp/clients/waiter.agent.json`

---

### CFO Agent 💰

**Purpose:** Financial operations (ledgers, invoices, journals)

**Grants:**
- `SELECT, INSERT, UPDATE` on `gl_entries`, `invoices`
- `SELECT` on `tax_rules`, `fx_rates`
- `INSERT, SELECT` on `pending_journals`

**RLS Scope:**
- Unrestricted access (but all writes audited)
- High-value journals (>$10k) require approval

**Example Tools:**
- `read_recent_journals` - Last 100 GL entries
- `post_invoice` - Create invoice
- `post_journal` - Direct GL posting (use cautiously)
- `request_journal_approval` - Queue for human approval

**Sample Config:** `mcp/clients/cfo.agent.json`

**Approval Workflow:**
1. Agent calls `request_journal_approval` → inserts into `pending_journals`
2. Notification sent to approver (Slack/email - configure in Edge Function)
3. Approver calls Edge Function `/approve_journal` with `action: approve|reject`
4. If approved, journal posted to `gl_entries` and `pending_journals.status = 'approved'`

---

### Legal Agent ⚖️

**Purpose:** Case management, filings, deadlines

**Grants:**
- `SELECT, INSERT, UPDATE` on `cases`, `filings`, `deadlines`
- `SELECT, INSERT` on `doc_store`

**RLS Scope:**
- Only cases where `assigned_to = auth.uid()`
- Cannot access unassigned or other users' cases

**Example Tools:**
- `fetch_case_docs` - Get all docs for a case
- `draft_filing` - Create draft filing
- `set_deadline` - Add deadline reminder

**Sample Config:** `mcp/clients/legal.agent.json`

---

## Tool Manifests

Tool manifests define SQL operations available to agents. Located in `mcp/`:

### Manifest Structure

```json
{
  "name": "agent_tools",
  "description": "Tools for XYZ agent",
  "tools": [
    {
      "name": "tool_name",
      "type": "sql",
      "description": "Human-readable description",
      "sql": "SELECT * FROM table WHERE id = :id",
      "parameters": [
        {
          "name": "id",
          "type": "uuid",
          "required": true
        }
      ]
    }
  ]
}
```

### Parameter Types

- `uuid` - Validated with regex
- `string` - Plain text
- `number` - Numeric (int or decimal)
- `date` - ISO 8601 date (YYYY-MM-DD)
- `timestamp` - ISO 8601 timestamp
- `jsonb` - JSON object or array

### Security Rules

✅ **DO:**
- Use parameterized queries (`:param_name`)
- Declare all parameters
- Validate inputs with Zod schemas
- Keep SQL simple and auditable

❌ **DON'T:**
- Use string concatenation (`'value' + var`)
- Use `DELETE` without `allowDangerous: true`
- Use `DROP`, `TRUNCATE`, or `GRANT service_role`
- Embed secrets in SQL

### Adding a New Tool

1. Edit the appropriate manifest (`waiter.tools.json`, `cfo.tools.json`, or `legal.tools.json`)
2. Add tool object with SQL and parameters
3. Run security lint: `pnpm security:lint-mcp`
4. Test locally: Update `mcp/clients/<agent>.agent.json` and invoke
5. Commit changes (tool manifests are version-controlled)

---

## Local Development

### Start All Services

```bash
pnpm dev:all
```

This runs:
- Vite dev server (port 8080)
- Agents service (port 8787)
- Supabase (port 54321)

### Point Agents to Local MCP

In `mcp/clients/<agent>.agent.json`:

```json
{
  "server": "http://localhost:54321/mcp",
  "auth": "oauth2",
  ...
}
```

Or use environment variable:

```bash
export SUPABASE_MCP_URL=http://localhost:54321/mcp
```

### Testing Workflow

1. **Unit Tests** (validation, parameter checking):
   ```bash
   pnpm test:mcp
   ```

2. **RLS Tests** (SQL-based):
   ```bash
   pnpm supabase:test
   ```

3. **Integration Tests** (full agent flow):
   ```bash
   # Reset DB with seed data
   pnpm supabase:reset
   
   # Run tests
   pnpm test:mcp
   ```

### Debugging

```bash
# Check Supabase logs
pnpm supabase:status
docker logs supabase_db_icupa-local-dev

# Query audit log
psql -h localhost -p 54322 -U postgres -d postgres
SELECT * FROM mcp_audit_log ORDER BY at DESC LIMIT 20;

# Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

---

## Security & Compliance

### Key Rotation

**OAuth2 Client Secrets** (rotate every 90 days):

1. Generate new secret in Supabase Dashboard
2. Update `.env.local` and CI secrets
3. Update all agent configs
4. Revoke old secret after grace period (1 week)

### Emergency Agent Revocation

**Option 1: Drop Role (immediate, destructive)**

```sql
DROP ROLE waiter_agent;
```

**Option 2: Revoke Grants (immediate, reversible)**

```sql
REVOKE ALL ON public.menus FROM waiter_agent;
REVOKE ALL ON public.orders FROM waiter_agent;
```

**Option 3: Disable via RLS (immediate, surgical)**

```sql
DROP POLICY waiter_orders_scope ON public.orders;
CREATE POLICY waiter_orders_scope ON public.orders
  FOR ALL USING (false);  -- Blocks all access
```

### Audit Queries

**Failed operations in last hour:**

```sql
SELECT *
FROM mcp_audit_log
WHERE ok = false
  AND at > now() - interval '1 hour'
ORDER BY at DESC;
```

**High-volume agents (potential abuse):**

```sql
SELECT role, COUNT(*) as operations
FROM mcp_audit_log
WHERE at > now() - interval '1 day'
GROUP BY role
ORDER BY operations DESC;
```

**Expensive operations (journal entries):**

```sql
SELECT *
FROM mcp_audit_log
WHERE tool = 'post_journal'
  AND (params->>'amount')::numeric > 10000
ORDER BY at DESC;
```

### Security Checklist

- [ ] All MCP environment variables stored in Vault/Secrets Manager
- [ ] `.env` and `.env.local` in `.gitignore`
- [ ] `pnpm security:lint-mcp` passes in CI
- [ ] RLS tests pass (`pnpm supabase:test`)
- [ ] Audit log queried weekly
- [ ] OAuth secrets rotated quarterly
- [ ] No `service_role` key in application code
- [ ] Human approval enabled for CFO >$10k

---

## Operations & Monitoring

### Deployment

**Migrations:**

```bash
# Production
supabase db push --linked

# Staging
supabase db push --db-url $STAGING_DATABASE_URL
```

**Edge Functions:**

```bash
supabase functions deploy approve_journal
```

### Monitoring

**Metrics to Track:**

- MCP operations per minute (by agent)
- Failed operations rate (target: <1%)
- Audit log growth (should be ~100 rows/day in production)
- Approval queue depth (pending_journals count)
- P99 latency per tool

**Alerts:**

- Failed ops >5% in 5 minutes → Page on-call
- Audit log >10,000 rows/day → Investigate abuse
- Pending approvals >10 → Notify CFO team
- OAuth token expiring in <7 days → Rotate

### Observability

**OpenTelemetry (OTEL):**

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to send MCP traces:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector.com
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer token
```

**Log Aggregation:**

MCP audit logs can be exported to DataDog/Splunk:

```sql
-- Export last 24h
COPY (
  SELECT * FROM mcp_audit_log
  WHERE at > now() - interval '1 day'
) TO '/tmp/mcp_audit_2025-01-15.csv' CSV HEADER;
```

---

## Troubleshooting

### Agent Cannot Connect

**Symptom:** "401 Unauthorized" or "Invalid OAuth token"

**Fix:**
1. Check `SUPABASE_MCP_OAUTH_CLIENT_ID` and `_SECRET` are correct
2. Verify OAuth client exists in Supabase Dashboard → Authentication → OAuth
3. Ensure token hasn't expired (rotate if needed)

---

### Tool Returns "Permission Denied"

**Symptom:** `ok: false, error: "permission denied for table xyz"`

**Fix:**
1. Check role has grants: `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'xyz';`
2. Verify RLS policies allow access: `SELECT * FROM pg_policies WHERE tablename = 'xyz';`
3. Ensure RLS context is set (e.g., `app.venue_id` for waiter)

---

### "Tool Not Found" Error

**Symptom:** `ok: false, error: "Tool 'xyz' not found"`

**Fix:**
1. Check tool name matches manifest exactly (case-sensitive)
2. Ensure manifest is loaded: `loadToolManifest(require('./mcp/waiter.tools.json'))`
3. Verify agent is using correct manifest path

---

### Audit Log Growing Too Fast

**Symptom:** `mcp_audit_log` table >1M rows

**Fix:**
1. Investigate high-volume agent: `SELECT role, COUNT(*) FROM mcp_audit_log GROUP BY role;`
2. Archive old logs: `DELETE FROM mcp_audit_log WHERE at < now() - interval '90 days';`
3. Enable log rotation (create cron job)

---

## Runbooks

### Runbook: Disable Runaway Agent

**Scenario:** Waiter agent making excessive API calls (suspected bug or abuse)

**Steps:**

1. **Immediate:** Disable RLS policy
   ```sql
   DROP POLICY waiter_orders_scope ON public.orders;
   CREATE POLICY waiter_orders_scope ON public.orders FOR ALL USING (false);
   ```

2. **Investigate:** Check audit log
   ```sql
   SELECT * FROM mcp_audit_log
   WHERE role = 'waiter_agent' AND at > now() - interval '1 hour'
   ORDER BY at DESC LIMIT 100;
   ```

3. **Restore:** Re-enable with original policy
   ```sql
   DROP POLICY waiter_orders_scope ON public.orders;
   CREATE POLICY waiter_orders_scope ON public.orders
     FOR ALL USING (
       current_role = 'waiter_agent'
       AND venue_id = coalesce(nullif(current_setting('app.venue_id', true), '')::uuid, venue_id)
     );
   ```

---

### Runbook: Approve Pending Journal

**Scenario:** CFO agent requested journal approval, human needs to review

**Steps:**

1. **List Pending:**
   ```sql
   SELECT id, entry_date, account_dr, account_cr, amount, memo, created_at
   FROM pending_journals
   WHERE status = 'pending'
   ORDER BY created_at DESC;
   ```

2. **Review:** Check amount, accounts, memo for reasonableness

3. **Approve:**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/approve_journal \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{"pending_journal_id": "uuid-here", "action": "approve"}'
   ```

4. **Verify:** Check `gl_entries` table
   ```sql
   SELECT * FROM gl_entries WHERE posted_by = 'approver-user-id' ORDER BY created_at DESC LIMIT 1;
   ```

---

### Runbook: Add New Agent Type

**Scenario:** Need to add "Support Agent" for ticket management

**Steps:**

1. **Migration:**
   ```sql
   -- 20250115000000_add_support_agent.sql
   CREATE ROLE support_agent;
   GRANT USAGE ON SCHEMA public TO support_agent;
   
   CREATE TABLE public.tickets (...);
   GRANT SELECT, INSERT, UPDATE ON public.tickets TO support_agent;
   
   ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
   CREATE POLICY support_tickets_rw ON public.tickets
     FOR ALL USING (current_role = 'support_agent');
   ```

2. **Tool Manifest:**
   ```json
   // mcp/support.tools.json
   {
     "name": "support_tools",
     "tools": [
       {"name": "fetch_ticket", "sql": "SELECT * FROM tickets WHERE id = :id"}
     ]
   }
   ```

3. **Agent Config:**
   ```json
   // mcp/clients/support.agent.json
   {
     "role": "support_agent",
     "tools_manifest": "./mcp/support.tools.json"
   }
   ```

4. **Tests:**
   ```bash
   pnpm security:lint-mcp
   pnpm test:mcp
   ```

---

## Sample Prompts

### Waiter Agent Prompt

```
You are a helpful waiter AI assistant for ICUPA, a multi-tenant PWA for in-venue ordering in Rwanda and Malta.

Your tools:
- read_menu: Get active menu items
- create_order: Place an order for a table
- update_payment_status: Mark payment as completed

Guidelines:
- Be polite and helpful
- Confirm orders before submitting
- Only use tools when necessary
- Don't make assumptions about unavailable items

Example interaction:
User: "I'd like a cappuccino for table A1"
You: "Great! Let me check the menu... [calls read_menu] We have cappuccino for $5. Shall I place the order?"
User: "Yes"
You: [calls create_order with venue_id, table_id=A1, items=[cappuccino], total=5]
```

---

### CFO Agent Prompt

```
You are a CFO AI assistant for ICUPA, handling financial operations.

Your tools:
- read_recent_journals: View last 100 GL entries
- post_invoice: Create customer invoice
- post_journal: Post journal entry (use sparingly)
- request_journal_approval: Queue journal for human approval

Guidelines:
- Always use request_journal_approval for amounts >$10,000
- Double-check account numbers before posting
- Provide clear memos for all entries
- Ask for confirmation before financial changes

Example interaction:
User: "Post a journal: debit 1000, credit 2000, $15,000"
You: "This is a high-value entry. I'll submit it for approval. [calls request_journal_approval]"
```

---

### Legal Agent Prompt

```
You are a legal assistant AI for ICUPA, managing cases and filings.

Your tools:
- fetch_case_docs: Get all documents for a case
- draft_filing: Create a draft filing
- set_deadline: Add case deadline

Guidelines:
- Only access cases assigned to the current user
- Never finalize filings without review
- Set deadline reminders proactively
- Summarize complex legal documents clearly

Example interaction:
User: "What docs do we have for case ABC-123?"
You: [calls fetch_case_docs] "I found 5 documents: contract, motion, brief, exhibit A, exhibit B. Would you like me to summarize any?"
```

---

## Further Reading

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Roles](https://www.postgresql.org/docs/current/user-manag.html)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [MCP Specification](https://github.com/supabase/mcp) _(hypothetical - adjust to actual spec)_

---

**Questions?** Open an issue or contact security@icupa.app

**Last Updated:** 2025-10-29  
**Version:** 1.0
