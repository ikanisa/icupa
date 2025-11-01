# Lighthouse PWA Audit (Static Analysis)

| App | Manifest | Service Worker | Offline Support | Installability | Notes |
| --- | --- | --- | --- | --- | --- |
| Staff PWA (`apps/vendor`) | ✅ `public/manifest.webmanifest` (name, theme, SVG icons) | ❌ No registration or SW file | ❌ No offline route; fetch falls back to network only | ❌ Without SW, Lighthouse installable audit fails | Needs Workbox precache, offline fallback, push notification integration. |
| Admin PWA (`apps/admin`) | ✅ `public/manifest.webmanifest` present | ❌ No SW registration | ❌ Admin console fetches rely on live Supabase/mock data | ❌ Missing SW prevents install prompt | Should add admin-specific caching, background sync for analytics. |

## Key Gaps
1. **Service Worker Registration** – Neither layout registers a SW. Add client component to register `sw.js`, handle updates, and show reload prompt.
2. **Offline Fallback** – Create `/offline` route (static) for both apps, cache shell & API responses (stale-while-revalidate for Supabase).
3. **Push Notifications** – VAPID key exists in env but no `Notification` request flow implemented.
4. **Performance Budgets** – Add `source-map-explorer` or `next build --analyze` with budgets in CI; integrate `lhci` for each app separately.
5. **Install Prompts** – Provide custom `beforeinstallprompt` UX with cancellation and logging.

## Recommended Actions
- Adopt Workbox via `next-pwa` or custom build step; precache critical routes (`/`, `/orders`, `/dashboard`).
- Add runtime caching strategies: Supabase REST (stale-while-revalidate), static assets (cache-first), images (cache-first with max-age).
- Provide offline data hydration from IndexedDB for last-known orders/analytics.
- Include push subscription manager referencing Supabase `notifications/subscribe_push` function.
