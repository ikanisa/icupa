#!/bin/bash
# Generate SBOM for each workspace

echo "Generating SBOM for root workspace..."
jq -n --arg name "icupa-monorepo" \
  --arg version "0.1.0" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    bomFormat: "CycloneDX",
    specVersion: "1.4",
    version: 1,
    metadata: {
      timestamp: $timestamp,
      component: {
        type: "application",
        name: $name,
        version: $version
      }
    },
    components: []
  }' > docs/sbom/icupa-root-basic.json

echo "Generating SBOM for agents-service..."
jq -n --arg name "agents-service" \
  --arg version "0.1.0" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    bomFormat: "CycloneDX",
    specVersion: "1.4",
    version: 1,
    metadata: {
      timestamp: $timestamp,
      component: {
        type: "application",
        name: $name,
        version: $version
      }
    },
    components: []
  }' > docs/sbom/agents-service.json

echo "SBOMs generated successfully"
