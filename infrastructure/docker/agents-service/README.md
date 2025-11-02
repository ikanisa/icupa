# agents-service Deployment Stack

This folder contains an opinionated container stack for running `agents-service` in production. It wraps the Node.js service in a hardened Docker image, exposes it through an authenticated TLS proxy, and exports traces to an OTLP collector that you can forward to Grafana Tempo, Honeycomb, or any OTLP-compatible backend.

## Components

| Service | Purpose |
| --- | --- |
| `agents-service` | Runs the compiled TypeScript service (`dist/server.js`). |
| `oauth2-proxy` | Enforces sign-in via your identity provider before requests reach the agents API. |
| `traefik` | Terminates TLS certificates via Let’s Encrypt and forwards traffic to the auth proxy. |
| `otel-collector` | Accepts OTLP/HTTP traces from the service and forwards them to your telemetry backend. |

## Prerequisites

1. Docker Engine 24+ with Compose v2 support.
2. DNS `A`/`AAAA` record that points `AGENTS_PUBLIC_HOST` at the host running the stack.
3. OAuth client credentials (Google Workspace, Azure AD, Okta, etc.) for `oauth2-proxy`.
4. Access to an OTLP-compatible tracing backend.

## Configuration Workflow

1. Copy the template environment files and fill in secrets:

   ```bash
   cp infrastructure/docker/agents-service/.env.example infrastructure/docker/agents-service/.env
   cp infrastructure/docker/agents-service/agents-service.env.example infrastructure/docker/agents-service/agents-service.env
   cp infrastructure/docker/agents-service/oauth2-proxy.env.example infrastructure/docker/agents-service/oauth2-proxy.env
   ```

2. Update `infrastructure/docker/agents-service/.env` with the public hostname, ACME contact email, and OTLP exporter target.
3. Populate `agents-service.env` with the OpenAI API key, Supabase service-role key, vector store IDs, and budget guardrails (`AGENT_SESSION_BUDGET_USD`, `AGENT_DAILY_BUDGET_USD`).
4. Set up the OAuth client in `oauth2-proxy.env`. The redirect URI must match `https://${AGENTS_PUBLIC_HOST}/oauth2/callback`.

## Build and Deploy

```bash
cd infrastructure/docker/agents-service
# Build and push (optional); local deploy just runs compose up
DOCKER_BUILDKIT=1 docker compose build
DOCKER_BUILDKIT=1 docker compose up -d
```

The stack publishes ports 80/443 for HTTP/S traffic. Traefik provisions TLS certificates via Let’s Encrypt and proxies requests through `oauth2-proxy` to the service. The service itself listens on the internal Docker network only.

## Telemetry

`agents-service` automatically exports traces when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The compose stack points this endpoint to the co-located collector (`http://otel-collector:4318`). The collector forwards traces to the URL stored in `OTLP_EXPORTER_ENDPOINT`, which should be an OTLP/HTTP ingest endpoint (for example, `https://tempo.icupa.dev/api/otlp`). If your provider requires authentication headers, place them in `OTLP_EXPORTER_HEADERS`.

## Health and Maintenance

* Traefik certificates are stored in the `traefik-acme` Docker volume. Back it up to avoid hitting ACME rate limits on redeploy.
* `oauth2-proxy` issues short-lived cookies by default. Adjust the lifetime via `OAUTH2_PROXY_COOKIE_REFRESH` and `OAUTH2_PROXY_COOKIE_EXPIRE`.
* The service exposes `/health`; Compose wires this endpoint into the container healthcheck.
* Rotate the OpenAI API key, Supabase service-role key, and OAuth client secret on the cadence defined in the security policy.

## Scaling to VMs or Kubernetes

*VM:* Copy the Compose stack onto the VM, install Docker, and run the commands above. Systemd unit templates are provided in `docs/deployment/agents-service.md` for production hardening.

*Kubernetes:* Use the Docker image published by your CI from this Dockerfile. Map the environment variables to a `Secret`, front the service with an Ingress that enables TLS + OIDC authentication (Traefik, NGINX, or Istio), and reuse the OTLP collector manifest or point to your platform collector.
