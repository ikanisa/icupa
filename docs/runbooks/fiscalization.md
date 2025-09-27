# Fiscalisation downtime runbook

This runbook covers how to respond when Rwanda’s EBM 2.1 service or Malta’s certified fiscal printers are unavailable. The goals are to keep service running for diners, preserve compliance data, and backfill receipts as soon as the fiscal platform recovers.

## 1. Detect the incident

- Alerts originate from the `receipt_issued` event stream. Under normal conditions the capture handler triggers the worker immediately, so receipts land within seconds. If a fiscal receipt is not created within 2 minutes, the worker emits a warning to Slack (`#ops-fiscalisation`).
- Merchant tablets will show a red banner on the Receipts screen whenever the most recent job has been in the queue for more than 3 minutes.
- Support can confirm by checking the Merchant Receipts dashboard (`/merchant/receipts`) for entries stuck in “Pending”.

## 2. Stabilise operations

1. **Keep taking payments.** All captures continue to store the queue job plus the raw payload needed for the fiscal device.
2. **Record the outage window.** Create an incident entry with start time, location, and payment references in the compliance log.
3. **Notify the venue lead.** Let the on-site manager know receipts are delayed and manual paper chits should be filed until recovery.

## 3. Recover receipts

1. Restore connectivity to the EBM service or fiscal printer. Confirm credentials and certificates are valid.
2. Visit `/merchant/receipts` and press **Run queue**. This triggers the `receipts/process_queue` Edge Function to replay the backlog.
3. For Rwanda, validate that the returned fiscal IDs appear in the official RRA dashboard. For Malta, ensure the printer produces signed copies.
4. Mark each receipt card as “Reprinted” so the audit trail reflects the successful replay.

## 4. If recovery fails

- **Retry policy:** The worker retries every 30 / 90 / 180 seconds (Rwanda) or 20 / 60 / 180 seconds (Malta). If three retries fail, escalate.
- **Escalate** to the contacts documented in the Receipts screen (RRA EBM service desk or Commissioner for Revenue helpdesk).
- Capture screenshots of error responses and attach them to the incident ticket.
- Do **not** delete queue jobs unless Legal approves a manual write-off.

## 5. Close the incident

1. Confirm every payment captured during the outage has a fiscal receipt or documented follow-up.
2. Update the compliance log with the resolution timestamp, ticket references, and any conversations with tax authorities.
3. Send a summary to stakeholders and archive the runbook entry alongside payment reconciliation records.

## Appendix: Useful links

- `/merchant/receipts` – merchant dashboard with retry controls and receipt history.
- `supabase/functions/receipts/process_queue` – worker that drains `fiscalization_jobs`.
- `supabase/functions/receipts/issue_ebm_rwanda` – simulated RRA payload generator.
- `supabase/functions/receipts/issue_fiscal_malta` – simulated Malta payload generator.
