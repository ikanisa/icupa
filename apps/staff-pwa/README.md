# Staff PWA

The staff-facing PWA is built with Next.js 14. Use the root package scripts
for local development to keep environment variables aligned:

```bash
pnpm dev:staff-pwa     # next dev
pnpm --filter @icupa/staff-pwa build
pnpm --filter @icupa/staff-pwa start
```

Environment variables load via `apps/staff-pwa/env.server.ts`, which wraps the
shared configuration helpers in `@icupa/config`.
