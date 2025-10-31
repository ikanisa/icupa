# ICUPA Repository Structure - Quick Reference

**Last Updated:** 2025-10-30  
**Status:** ✅ All Requirements Met

---

## 🎯 Quick Answer

**Q: Does ICUPA have three PWAs?**  
✅ **YES** - Client (diner), Merchant (vendor), and Admin panel.

**Q: Are AI agents managed via the admin panel?**  
✅ **YES** - Full AI agent configuration at `/admin` with AgentSettingsPanel.

**Q: Is the repository structure appropriate?**  
✅ **YES** - Clean monorepo with proper separation.

---

## 📁 Production Structure

```
ICUPA Production (Deployed via CI)
│
└─── src/ (Vite + React SPA)
     │
     ├─── / (Client PWA)
     │    └─ components/client/
     │    └─ modules/client/
     │
     ├─── /merchant (Merchant PWA)
     │    └─ components/merchant/
     │    └─ modules/merchant/
     │
     └─── /admin (Admin Panel + AI Management)
          └─ components/admin/
          └─ modules/admin/
```

**Build Command:** `pnpm build`  
**Entry Point:** `src/main.tsx`  
**Router:** React Router (client-side)

---

## 🤖 AI Agents Service

```
agents-service/ (Separate Fastify Service)
│
├─── AI Waiter
├─── Allergen Guardian
└─── Upsell Agent

Managed via: /admin (Admin Panel)
```

**Integration:**
- Admin Panel → Supabase Edge Functions → agents-service
- Configuration stored in: `agent_runtime_configs` table
- Audit logs in: `agent_config_audit_events` table

---

## 🧪 Experimental Apps (Not Deployed)

```
apps/ (Next.js implementations - for exploration)
│
├─── client/   (Next.js client PWA)
├─── vendor/   (Next.js vendor PWA)
├─── admin/    (Next.js admin panel)
└─── web/      (Next.js unified app)
```

**Status:** Not deployed, kept for future migration exploration.

---

## 🎨 Three PWA Surfaces

| Surface | Route | Purpose | Location |
|---------|-------|---------|----------|
| **Client** | `/` | Diner ordering | `src/components/client/` |
| **Merchant** | `/merchant` | Restaurant operations | `src/components/merchant/` |
| **Admin** | `/admin` | Platform admin + AI config | `src/components/admin/` |

---

## 🛠️ AI Agent Management Features

**Admin Panel → /admin → AI Settings**

- ✅ Autonomy levels (0-3)
- ✅ Budget limits (USD/day, USD/session)
- ✅ Tool allow-lists
- ✅ Custom instructions
- ✅ Experiment flags
- ✅ Audit logs
- ✅ Kill switches

**Component:** `src/components/admin/AgentSettingsPanel.tsx`

---

## 🏗️ Architecture Decision

### Current (Production)
**Single Vite SPA** with three surfaces via React Router

**Pros:**
- ✅ Shared components and utilities
- ✅ Simple deployment (one artifact)
- ✅ Fast development iteration
- ✅ Consistent UX

**Cons:**
- ⚠️ Larger initial bundle (mitigated by code splitting)

### Future (Experimental)
**Separate Next.js apps** per surface

**Pros:**
- ✅ Independent deployments
- ✅ Better SEO per surface
- ✅ Server-side rendering
- ✅ Smaller bundles

**Cons:**
- ⚠️ More complex deployment
- ⚠️ Potential code duplication

---

## 📊 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript 5.8 |
| Build | Vite 5.4 |
| Styling | Tailwind CSS 3.4 |
| UI | Radix UI |
| State | Zustand + TanStack Query |
| Backend | Supabase (PostgreSQL + Auth) |
| Agents | Fastify + OpenAI SDK |
| Payments | Stripe, MTN MoMo, Airtel |

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run dev server (all three surfaces)
pnpm dev
# → http://localhost:8080 (client)
# → http://localhost:8080/merchant (merchant)
# → http://localhost:8080/admin (admin)

# Run agents service
pnpm dev:agents
# → http://localhost:8787

# Build production
VITE_SUPABASE_URL=https://test.supabase.co \
VITE_SUPABASE_ANON_KEY=test \
pnpm build

# Lint & typecheck
pnpm lint
pnpm typecheck
```

---

## 📖 Documentation

- **Main README:** [README.md](../README.md)
- **Architecture:** [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Agents Service:** [agents-service/README.md](../agents-service/README.md)
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## ✅ Verification Checklist

- [x] Three PWAs exist: Client, Merchant, Admin
- [x] All three surfaces are implemented
- [x] AI agents service is separate
- [x] AI agents managed via admin panel
- [x] Admin panel has full agent configuration UI
- [x] Repository structure is appropriate
- [x] Documentation is clear and accurate
- [x] Build passes: `pnpm build`
- [x] Typecheck passes: `pnpm typecheck`
- [x] No structural issues identified

---

## 🎯 Key Takeaways

1. **Production app is the Vite SPA in `src/`** (not the apps in `apps/`)
2. **All three PWAs are in ONE app** accessed via different routes
3. **AI agents ARE managed via admin panel** at `/admin`
4. **Experimental Next.js apps in `apps/` are NOT deployed**
5. **Repository structure is CORRECT and APPROPRIATE**

---

**Questions?** See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for detailed architecture documentation.
