# MCP (Model Context Protocol) - AI Agent Tools

This directory contains the Model Context Protocol integration for ICUPA's AI agents.

## Directory Structure

```
mcp/
├── runtime/
│   └── executeTool.ts        # Tool execution wrapper with Zod validation
├── clients/
│   ├── waiter.agent.json     # Waiter agent configuration
│   ├── cfo.agent.json        # CFO agent configuration
│   └── legal.agent.json      # Legal agent configuration
├── waiter.tools.json         # Waiter agent tool manifest
├── cfo.tools.json            # CFO agent tool manifest
└── legal.tools.json          # Legal agent tool manifest
```

## Quick Start

### 1. Setup Local Environment

```bash
# Start Supabase
pnpm supabase:start

# Apply MCP migration
pnpm supabase:migrate

# Run tests
pnpm test:mcp
```

### 2. Configure Agent

Copy and customize an agent configuration:

```bash
cp mcp/clients/waiter.agent.json mcp/clients/waiter.agent.local.json
```

Edit `waiter.agent.local.json` with your credentials:
- `server`: Point to local (`http://localhost:54321/mcp`) or remote MCP URL
- `client_id` and `client_secret`: OAuth2 credentials from Supabase
- `rls_context`: Set context variables (e.g., `app.venue_id` for waiter)

### 3. Use in Application

```typescript
import { executeTool, loadToolManifest } from './mcp/runtime/executeTool';
import waiterTools from './mcp/waiter.tools.json';

const manifest = loadToolManifest(waiterTools);

const result = await executeTool(
  {
    role: 'waiter_agent',
    toolName: 'read_menu',
    params: {},
    rls_context: { 'app.venue_id': 'uuid-here' }
  },
  { waiter: manifest },
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (result.ok) {
  console.log('Menu items:', result.data);
} else {
  console.error('Error:', result.error);
}
```

## Tool Manifests

Tool manifests define SQL operations available to agents. Each manifest is a JSON file with:

- `name`: Manifest identifier
- `description`: Human-readable description
- `tools`: Array of tool definitions

### Tool Definition

```json
{
  "name": "tool_name",
  "type": "sql",
  "description": "What this tool does",
  "sql": "SELECT * FROM table WHERE id = :id",
  "parameters": [
    {
      "name": "id",
      "type": "uuid",
      "required": true
    }
  ]
}
```

### Parameter Types

- `uuid`: UUID format (validated with regex)
- `string`: Plain text
- `number`: Numeric value (int or decimal)
- `date`: ISO 8601 date (YYYY-MM-DD)
- `timestamp`: ISO 8601 timestamp
- `jsonb`: JSON object or array

## Security

### Best Practices

✅ **DO:**
- Use parameterized queries (`:param_name`)
- Validate all inputs
- Test with `pnpm security:lint-mcp`
- Keep SQL simple and auditable
- Log all operations to `mcp_audit_log`

❌ **DON'T:**
- Use string concatenation
- Use `DELETE` without `allowDangerous: true`
- Use `DROP`, `TRUNCATE`, or `GRANT service_role`
- Embed secrets in SQL

### Security Lint

Run security checks:

```bash
pnpm security:lint-mcp
```

This validates:
- No dangerous SQL patterns (DELETE, DROP, TRUNCATE)
- All parameters are declared
- No dynamic SQL string building

## Testing

### Unit Tests

```bash
pnpm test:mcp
```

Tests cover:
- Tool manifest loading and validation
- Parameter validation (required, types, formats)
- Type conversion (string to number, JSON parsing)
- Error handling

### Integration Tests

```bash
pnpm supabase:test
```

Tests cover:
- RLS policies for each agent role
- Permission grants
- Negative test cases (agent cannot access other tables)

## Agent Roles

### Waiter Agent 🍽️
- **Tables:** menus, orders, payments_pending
- **Scope:** venue_id (via RLS context)
- **Tools:** read_menu, create_order, update_payment_status

### CFO Agent 💰
- **Tables:** gl_entries, invoices, tax_rules, fx_rates, pending_journals
- **Scope:** Unrestricted (all writes audited)
- **Tools:** read_recent_journals, post_invoice, post_journal, request_journal_approval
- **Approval:** Journals >$10k require human approval

### Legal Agent ⚖️
- **Tables:** cases, filings, doc_store, deadlines
- **Scope:** assigned_to = auth.uid()
- **Tools:** fetch_case_docs, draft_filing, set_deadline

## Documentation

See [docs/ai-agents/mcp-guide.md](../docs/ai-agents/mcp-guide.md) for:
- Complete setup instructions
- Architecture diagrams
- Security best practices
- Operations & monitoring
- Troubleshooting guides
- Runbooks

## Support

- **Issues:** Open a GitHub issue with `[MCP]` prefix
- **Security:** security@icupa.app
- **Documentation:** [MCP Guide](../docs/ai-agents/mcp-guide.md)
