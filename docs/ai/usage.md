# AI Waiter UI Integration

Client surfaces should depend on the `modules/agents-ui` exports rather than importing from `src/components/ai` or `src/hooks` directly. This keeps the module boundary stable while we evolve the implementation.

For a typical waiter chat dock:

```tsx
import { AIChatScreen } from '@/modules/diner';
import { Badge } from '@/modules/common';

<AIChatScreen
  tableSessionId={session?.id}
  tenantId={tenantId}
  locationId={locationId}
  cartItems={cartSnapshot}
  onAddToCart={handleAddToCart}
/>;
```

The module re-exports everything needed (`useAgentChat`, `ChatComposer`, `AgentRunDetailsDialog`) so custom shells can reuse the same primitives. Feature toggles are read from `import.meta.env.VITE_AGENTS_STREAMING` and `VITE_AGENTS_LONG_POLLING`; override them per environment using `.env`.

Voice interactions will live in `modules/agents-ui` once the realtime button lands; until then, use the text chat surface (`AIChatScreen`) or build voice-specific components inside the module.
