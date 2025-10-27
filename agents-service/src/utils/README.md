# Utilities

## PII Redaction (`redact.ts`)

The `redactPII()` function provides simple PII redaction for user inputs and model outputs before persisting to telemetry or logs.

### Usage

```typescript
import { redactPII } from './utils/redact';

// Before logging user input
const userMessage = "Contact me at john@example.com or call +1-555-1234";
const safeMessage = redactPII(userMessage);
// Result: "Contact me at [REDACTED_EMAIL] or call [REDACTED_PHONE]"

// Before persisting to telemetry
await logAgentEvent({
  input: redactPII(userInput),
  output: redactPII(modelOutput),
  // ... other params
});
```

### What it redacts

- **Phone numbers**: International and local formats (e.g., `+1-555-123-4567`, `555 123 4567`)
- **Email addresses**: Standard email formats (e.g., `user@example.com`)
- **API keys/tokens**: Common patterns like `sk-...`, `api_...`, `key-...` with 16+ characters

### Important notes

⚠️ **Always call `redactPII()` before:**
- Logging user messages or model responses
- Persisting data to telemetry systems
- Storing conversation history in databases
- Sending data to third-party analytics

⚠️ **Security considerations:**
- This is a **basic heuristic** helper, not a comprehensive PII solution
- Extend the regexes to match your specific threat model
- Keep raw, unredacted transcripts **only** in highly-protected stores with strict access controls
- Consider additional redaction for sensitive domain-specific data (credit cards, SSNs, etc.)

### Example integration

For the existing `redactSensitiveText()` in `pii.ts`, you can use both helpers together:

```typescript
// Chain both for comprehensive protection
const fullyRedacted = redactPII(redactSensitiveText(userInput));
```
