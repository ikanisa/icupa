# ICUPA Netlify Deployment Guide

## Overview

This guide explains how to deploy the ICUPA monorepo client and admin PWAs to Netlify with Supabase backend.

## Prerequisites

- Netlify account
- Supabase project (production and/or staging)
- GitHub repository access
- Node.js 20.10.0+
- pnpm 10.4.0+

## Repository Structure

```
icupa/
├── netlify.toml                    # Root Netlify config
├── apps/
│   ├── client/
│   │   ├── netlify.toml           # Client app Netlify config
│   │   └── netlify/
│   │       └── functions/         # Serverless functions for client
│   │           ├── health.ts
│   │           └── api-proxy.ts
│   └── admin/
│       ├── netlify.toml           # Admin app Netlify config
│       └── netlify/
│           └── functions/         # Serverless functions for admin
│               └── health.ts
├── .github/workflows/
│   └── deploy-netlify.yml         # GitHub Actions CI/CD
└── scripts/
    └── remove-vercel-cloudflare.sh # Cleanup script
```

## Step 1: Create Netlify Sites

### 1.1 Client App

1. Log into Netlify
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select the `icupa` repository
4. Configure build settings:
   - **Build command**: `cd ../.. && pnpm install && pnpm --filter @icupa/client build`
   - **Publish directory**: `apps/client/out`
   - **Base directory**: `apps/client`
5. Note the **Site ID** (needed for GitHub Actions)

### 1.2 Admin App

Repeat the same process for the admin app:
- **Build command**: `cd ../.. && pnpm install && pnpm --filter @icupa/admin build`
- **Publish directory**: `apps/admin/.next`
- **Base directory**: `apps/admin`
- Note the **Site ID**

## Step 2: Configure Environment Variables

Add the following environment variables in each Netlify site's dashboard (Site settings → Environment variables):

### Required for Both Apps

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# App Configuration
VITE_APP_NAME=ICUPA
NODE_VERSION=20.10.0
NEXT_TELEMETRY_DISABLED=1
```

### Required for Admin App Only

```bash
# Service Role Key for server-side operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional Environment Variables

```bash
# Agents Service
VITE_AGENTS_URL=https://agents.icupa.dev
VITE_AGENTS_STREAMING=true

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=your-otel-endpoint
OTEL_EXPORTER_OTLP_HEADERS=your-otel-headers

# Feature Flags
AI_RESPONSES_ENABLED=true
WHATSAPP_INTEGRATION_ENABLED=true
VOUCHER_CREATION_ENABLED=true
```

## Step 3: Configure GitHub Actions

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```bash
NETLIFY_AUTH_TOKEN=your-netlify-auth-token
NETLIFY_CLIENT_SITE_ID=your-client-site-id
NETLIFY_ADMIN_SITE_ID=your-admin-site-id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### How to Get Netlify Auth Token

1. Go to Netlify User Settings → Applications
2. Click "New access token"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token immediately (it won't be shown again)

## Step 4: Deploy

### Manual Deployment

```bash
# Install dependencies
pnpm install

# Build client app
pnpm --filter @icupa/client build

# Build admin app
pnpm --filter @icupa/admin build

# Deploy using Netlify CLI
netlify deploy --prod --dir apps/client/out --site $NETLIFY_CLIENT_SITE_ID
netlify deploy --prod --dir apps/admin/.next --site $NETLIFY_ADMIN_SITE_ID
```

### Automatic Deployment via GitHub Actions

The `.github/workflows/deploy-netlify.yml` workflow will automatically deploy on:
- Push to `main` branch (production)
- Push to `develop` branch (preview)
- Pull requests (preview)

## Step 5: Verify Deployment

### Health Checks

After deployment, verify the apps are running:

```bash
# Check client health
curl https://your-client-site.netlify.app/.netlify/functions/health

# Check admin health
curl https://your-admin-site.netlify.app/.netlify/functions/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "responseTime": "5ms",
  "environment": {
    "node": "v20.10.0",
    "configured": {
      "supabaseUrl": true,
      "supabaseKey": true,
      "nodeVersion": "v20.10.0"
    }
  }
}
```

### PWA Verification

1. Open the deployed site in Chrome
2. Open DevTools → Application tab
3. Verify:
   - Service Worker is registered
   - Manifest is loaded
   - Cache Storage is working

## Step 6: Post-Deployment Configuration

### Custom Domains

1. Go to Site settings → Domain management
2. Add custom domain
3. Configure DNS:
   - **Client**: `app.yourdomain.com` or `www.yourdomain.com`
   - **Admin**: `admin.yourdomain.com`

### HTTPS and Security

Netlify automatically provisions SSL certificates. Verify:
- SSL certificate is active
- Force HTTPS is enabled
- HSTS headers are configured (already in netlify.toml)

### Environment-Specific Configurations

For staging environments:
1. Create separate Netlify sites for staging
2. Use environment-specific Supabase projects
3. Update GitHub Actions workflow to deploy to staging sites

## Troubleshooting

### Build Failures

**Error**: `pnpm: command not found`
- **Solution**: Ensure `NODE_VERSION` is set in environment variables

**Error**: `VITE_SUPABASE_URL is not defined`
- **Solution**: Add environment variables in Netlify dashboard

**Error**: `Build exceeded maximum allowed runtime`
- **Solution**: Check build logs for unnecessary operations, consider splitting builds

### Runtime Errors

**Error**: `Failed to fetch from Supabase`
- **Solution**: Verify environment variables are correctly set and Supabase project is accessible

**Error**: `Service Worker registration failed`
- **Solution**: Check PWA configuration in vite.config.ts, ensure HTTPS is enabled

### Function Errors

**Error**: `Function invocation failed`
- **Solution**: Check function logs in Netlify dashboard, verify dependencies are installed

## Monitoring and Observability

### Netlify Analytics

Enable Netlify Analytics in Site settings → Analytics & logs

### External Monitoring

Configure external monitoring services:
- **Uptime**: Use services like UptimeRobot, Pingdom
- **Performance**: Use Lighthouse CI, WebPageTest
- **Errors**: Use Sentry (already configured in admin app)

## Rollback Procedure

If deployment fails or introduces issues:

1. Go to Netlify site → Deploys
2. Find the last working deployment
3. Click "Publish deploy" to rollback

## Additional Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Next.js on Netlify](https://docs.netlify.com/integrations/frameworks/next-js/)
- [Supabase Documentation](https://supabase.com/docs)
- [ICUPA Repository](https://github.com/ikanisa/icupa)

## Support

For issues or questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check SUPPORT.md for additional help
