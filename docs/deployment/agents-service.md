# agents-service Production Deployment

This guide explains how to promote `agents-service` from local development to a hardened production footprint. It covers container images, VM provisioning, TLS/authentication, telemetry, and environment propagation to the Vercel front-ends.

## 1. Build & Publish the Container

1. Ensure you are logged into the container registry (`ghcr.io`):
   ```bash
   echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
   ```
2. Build and push the multi-stage image:
   ```bash
   DOCKER_BUILDKIT=1 docker build -t ghcr.io/icupa/agents-service:${GIT_SHA} -f agents-service/Dockerfile .
   docker push ghcr.io/icupa/agents-service:${GIT_SHA}
   docker tag ghcr.io/icupa/agents-service:${GIT_SHA} ghcr.io/icupa/agents-service:latest
   docker push ghcr.io/icupa/agents-service:latest
   ```
3. Record the image digest in the change log (Ops runbook) for rollback purposes.

## 2. Provision the Runtime Host

We support two patterns:

### Option A – Docker Compose on a Hardened VM

1. Provision an Ubuntu 24.04 LTS VM with at least 2 vCPU, 4 GB RAM.
2. Install Docker Engine + Compose (`apt install docker.io docker-compose-plugin`).
3. Create a system user `icupa` and copy `deployments/agents-service` onto the VM.
4. Follow the README in that folder to copy `.env`, `agents-service.env`, and `oauth2-proxy.env`.
5. Create a systemd unit (`/etc/systemd/system/agents-service.service`):
   ```ini
   [Unit]
   Description=ICUPA agents-service stack
   After=network.target docker.service
   Requires=docker.service

   [Service]
   WorkingDirectory=/opt/icupa/deployments/agents-service
   ExecStart=/usr/bin/docker compose up -d
   ExecStop=/usr/bin/docker compose down
   TimeoutStartSec=0
   RemainAfterExit=yes
   Restart=on-failure
   User=icupa

   [Install]
   WantedBy=multi-user.target
   ```
6. Enable and start the service: `sudo systemctl enable --now agents-service.service`.

### Option B – Kubernetes (GKE/AKS/EKS)

1. Push the image as above and create a `Deployment` referencing `ghcr.io/icupa/agents-service:${GIT_SHA}`.
2. Mount secrets via `Secret` objects containing the environment variables listed below.
3. Expose the pod with an Ingress controller that provides TLS and OIDC authentication (Traefik with `forwardAuth`, NGINX + `oauth2-proxy`, or Istio `RequestAuthentication`).
4. Configure an `otlphttp` exporter (Tempo/Grafana Cloud, Honeycomb, Datadog) and set `OTEL_EXPORTER_OTLP_ENDPOINT` + headers on the pod.

## 3. Required Environment Variables

Populate these variables for both production and disaster recovery regions:

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | Primary OpenAI key for the GPT-4 family. Rotate via 1Password “ICUPA OpenAI Prod”. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key with row-level security bypass for Supabase actions. |
| `SUPABASE_URL` | URL for the Supabase instance matching the service region. |
| `AGENTS_MENU_VECTOR_STORE_ID` | Vector store for core menu content. |
| `AGENTS_ALLERGENS_VECTOR_STORE_ID` | Vector store for allergens. |
| `AGENTS_POLICIES_VECTOR_STORE_ID` | Vector store for compliance/policies. |
| `AGENT_SESSION_BUDGET_USD` | Per-session OpenAI budget cap (default `0.75`). |
| `AGENT_DAILY_BUDGET_USD` | Rolling daily budget cap (default `50`). |
| `OPENAI_DEFAULT_MODEL` / `OPENAI_LOW_COST_MODEL` / `OPENAI_FAILOVER_MODEL` | Model routing preferences. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Always points to `http://otel-collector:4318` in Compose; override when deploying directly. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Optional headers (e.g., `Authorization=Bearer abc`). |

## 4. TLS + Auth Proxy

* In Docker Compose we bundle Traefik + oauth2-proxy.
* For Kubernetes, add annotations such as:
  ```yaml
  traefik.ingress.kubernetes.io/router.entrypoints: websecure
  traefik.ingress.kubernetes.io/router.tls: "true"
  traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
  traefik.ingress.kubernetes.io/router.middlewares: auth-forward@kubernetescrd
  ```
  and point the middleware at your oauth proxy deployment.
* Ensure the public DNS record (`agents.icupa.dev`) is routed through Cloudflare with proxy disabled to avoid double TLS termination.

## 5. Telemetry Wiring

`agents-service/src/observability.ts` starts OpenTelemetry whenever `OTEL_EXPORTER_OTLP_ENDPOINT` is set. In production we set:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=icupa-agents-service
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>
```

The sidecar collector reads `OTLP_EXPORTER_ENDPOINT` and `OTLP_EXPORTER_HEADERS` from the Compose `.env` file and forwards traces to Grafana Tempo. Update the headers when the Grafana Cloud API token rotates.

## 6. Wire the URL into Vercel

After promoting a new deployment, update the browser applications to call the fresh endpoint:

```bash
vercel env add NEXT_PUBLIC_AGENTS_URL https://agents.icupa.dev --environment=production
vercel env add VITE_AGENTS_URL https://agents.icupa.dev --environment=production
vercel env pull --environment=preview
```

Update both Preview and Production environments. The deployment script (`scripts/deploy/vercel-preview.mjs`) now validates that the agents URL variables are present before allowing a deploy.

## 7. Runbook Updates

Refer to `docs/runbooks/agents-service.md` for day-2 operations (rotation, failover, alerts). The runbook includes escalation paths and rollback procedures tied to the container image digests.
