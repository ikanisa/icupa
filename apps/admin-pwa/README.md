# Admin PWA

The admin console is implemented with Next.js and reuses shared packages for UI
and configuration. Recommended root scripts:

```bash
pnpm dev:admin-pwa     # next dev
pnpm --filter @icupa/admin-pwa build
pnpm --filter @icupa/admin-pwa start
```

Server-only environment variables are surfaced through `apps/admin-pwa/env.server.ts`.
