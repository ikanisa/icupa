# Data Subject Request (DSR) playbook

This runbook captures the standard operating procedure for handling export and deletion requests across ICUPA tenants.

## Intake checklist
- Confirm the requester identity aligns with the `subject_identifier` stored in Supabase (`dsr_requests.subject_identifier`).
- Validate contact information and required lawful basis (consent, contract, or legitimate interest) with the tenant privacy lead.
- Capture the request in the admin console or directly in Supabase with the following metadata:
  - `tenant_id`
  - `region`
  - request type (`export` or `delete`)
  - contact email for delivery / confirmation
  - any runbook notes for auditors (link to ticket, chat transcript, etc.)

## Fulfilment steps
1. Acknowledge the request within 24 hours and update the DSR status to `in_progress`.
2. For **export** requests:
   - Use the Supabase service role to export all tables scoped to the diner (`orders`, `table_sessions`, `payments`, `receipts`).
   - Remove internal-only columns (internal notes, fraud scores) and package the dataset as encrypted ZIP.
   - Deliver via secure channel (ShareFile or tenant-provided vault) and capture the delivery timestamp in the DSR record.
3. For **delete** requests:
   - Pause marketing syncs and disable push/email profiles.
   - Soft-delete diner-authored content (orders, chat logs) while retaining fiscal data required for tax.
   - Trigger downstream revocations (push subscriptions, embeddings) and verify caches are flushed.
   - Mark the request `completed` only after the Supabase data retention job confirms anonymisation.
4. Document any data that could not be deleted (e.g. fiscal receipts retained for legal obligations) in the DSR notes and notify the requester.

## Closure
- Set the DSR status to `completed` in the admin console once fulfilment finishes and log the completion timestamp.
- Store artefacts (export archive checksum, confirmation email) in `artifacts/privacy/dsr/<request-id>/` with restricted access.
- Update the privacy register and, if applicable, inform the supervisory authority of the fulfilment timeline.

## Escalation
- If the request spans multiple tenants, escalate to the privacy officer (`privacy@icupa.test`).
- For deletions conflicting with fiscal retention requirements, involve the finance lead before proceeding.
- Any security concerns (account takeover, fraud) must be escalated via the incident management runbook.

## Resources
- [`dsr_requests` schema reference](../../supabase/migrations/20240408000000_phase8_dsr_requests.sql)
- [Admin console Phase 8 overview](../implementation-plan.md#phase-8--admin-console-weeks-14-16)
- GDPR Article 12–23 summary (data subject rights)
