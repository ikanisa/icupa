# Infrastructure Layout

This directory organizes deployment assets by target platform:

- `docker/` holds container-compose stacks and local orchestration helpers.
- `k8s/` is reserved for Kubernetes manifests and Helm charts.
- `terraform/` captures IaC modules and environment state definitions.

Each subfolder keeps application-specific manifests in dedicated subdirectories
so future services can adopt the same structure without mixing concerns.
