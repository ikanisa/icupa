# Geo Redundancy Snapshot Playbook

This guide documents how we maintain manual snapshot copies across primary and standby regions. The flow assumes the production primary runs in `us-east-1` and the warm standby environment lives in `eu-central-1`.

## Snapshot Copy Workflow

1. **Kick off `dr-snapshot` function**
   - Trigger the Supabase Edge Function `dr-snapshot` with a descriptive `label` such as `daily-dr`.
   - Confirm the function reports `ok: true` and record the returned `snapshot_id` and storage path.
2. **Export manifest to geo bucket**
   - Use Supabase Storage browser or `supabase storage cp` to copy the generated JSON bundle to the `dr_backups` bucket in the standby project.
   - Mirror the object path structure (`<year>/<month>/<day>/<label>_<timestamp>.json`) to simplify lookups.
3. **Log audit trail**
   - Create an entry in the DR change log spreadsheet including:
     - Snapshot label and ID
     - Source bucket path
     - Destination bucket path
     - Operator initials and timestamp
4. **Notify observability channel**
   - Post a short update in `#ops-dr` noting the transfer completion and include the manifest checksum.

## Scheduling

| Frequency | Window (UTC) | Owner | Notes |
|-----------|--------------|-------|-------|
| Daily | 02:00–03:00 | On-call SRE | Runs Monday–Sunday to capture previous day activity. |
| Weekly | Sunday 05:00–06:00 | DR Lead | Verify long-term retention policy and prune copies older than 90 days. |
| Ad-hoc | Within 15 minutes of Sev-1 incident | Incident Commander | Execute immediately after incident stabilization. |

- Daily copies must be verified before 04:00 UTC.
- Weekly copies require checksum comparison across regions and confirmation of at least three historical restore points.

## Verification Steps

1. **Checksum validation**
   - Compute SHA-256 checksums locally (`shasum -a 256 <file>`) for both primary and standby manifests.
   - Values must match the checksum recorded by `dr-snapshot`. Mismatches trigger a Sev-2 incident.
2. **Schema coverage check**
   - Confirm the manifest contains all tables listed in `DEFAULT_TABLES` of the snapshot function.
   - Escalate to data team if any table is missing.
3. **Remote verification stub (`dr-verify-remote`)**
   - Call the new Supabase Edge Function with the payload `{ "useFixtures": true }` to exercise the diff logic.
   - Review the returned `diff.summary`; any `missing_in_remote` or `mismatched` entries must be resolved before marking the copy healthy.
   - Confirm `diff.metadata.summary.mismatched` is `0` when checking real manifests—metadata mismatches indicate the snapshots are from different runs.
4. **Health endpoint**
   - Perform `GET /dr-verify-remote/health` from both primary and standby environments. Expect `{ "ok": true }`.
5. **Ticket update**
   - Update the DR Ops ticket with verification evidence (checksums, diff output, health checks). Close only after approval from the DR Lead.

## Escalation Matrix

- **Checksum failure** → page the on-call SRE, open Sev-2, loop in storage team.
- **Missing tables** → notify data engineering, block downstream restores until resolved.
- **Function error** → capture logs via Supabase dashboard, file an issue under `ops/dr` with request ID.

Maintaining disciplined geo redundancy keeps our recovery point objective under 15 minutes and ensures we can rehydrate the standby region at any time.
