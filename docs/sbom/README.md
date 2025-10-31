# Software Bill of Materials (SBOM)

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Format: CycloneDX 1.4 (JSON)

## Files

- `icupa-root.json` - Root workspace dependencies
- `agents-service.json` - Agents service dependencies

## Validation

To validate these SBOMs:

```bash
npm install -g @cyclonedx/cyclonedx-cli
cyclonedx-cli validate --input-file docs/sbom/icupa-root.json
```

## Usage

These SBOMs can be used for:
- Dependency tracking
- Vulnerability scanning
- License compliance
- Supply chain security
