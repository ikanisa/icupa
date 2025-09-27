# Payments Timeout Runbook

This runbook covers detection, triage, and remediation steps when diners cannot complete payments because third-party payment providers (Stripe, Adyen, MTN MoMo, Airtel Money) fail to acknowledge requests within the expected SLA.

## Detection

1. **Automated alerts**
   - Cloud monitoring alarms on the `payments/stripe/*`, `payments/momo/*`, and `payments/airtel/*` Edge Function latency/error metrics breach the p95≤5s and error-rate≤1% thresholds.
   - Checkout funnel dashboards show sudden drops in `checkout_success_pct` below 99.5% or spikes in pending payments older than five minutes.
2. **User reports**
   - Diners see repeated "Awaiting provider" toasts in the payment screen or escalate via support.
   - Merchant tablets show orders stuck in `pending_payment` within the payments desk view.

## Immediate response

1. **Acknowledge the incident**
   - Page the on-call engineer and payments liaison.
   - Open an incident channel with context from monitoring widgets (latency graphs, failure counts).
2. **Stabilise diner UX**
   - Confirm the diner app is surfacing the offline fallback banner and instructs guests not to retry charges repeatedly.
   - If the PSP outage is confirmed, toggle the relevant feature flag (Stripe, Adyen, MoMo, Airtel) to disable new intents while keeping existing sessions visible.
3. **Inspect queue backlogs**
   - Query the `payments` table for rows in `pending` older than five minutes to assess the backlog size.
   - Check the PGMQ `fiscalisation_jobs` queue for growth indicating captures are not flowing.
4. **Engage providers**
   - Review PSP status pages (Stripe, Adyen) and aggregator dashboards (MoMo, Airtel) for outage notices.
   - File or update support tickets if the issue appears provider-side.

## Mitigation options

- **Retry stuck intents**
  - Re-run idempotent webhook handlers (`payments/stripe/webhook`, `payments/momo/webhook`, `payments/airtel/webhook`) using stored payloads when providers resume service.
- **Fail over payment routes**
  - If one PSP is affected (e.g., Stripe), switch tenant routing to the alternate provider (Adyen) for EU or encourage cash/manual collection for Rwanda while the mobile-money API is down.
- **Communicate with diners and merchants**
  - Update the in-app status ribbon with a clear incident banner, provide manual payment guidance, and use push/email to notify active sessions when the system recovers.

## Recovery verification

1. **Monitor success rates**
   - Ensure the next 20+ transactions complete with p95 latency ≤2s and webhook acknowledgements within 30s.
2. **Clear backlog**
   - Confirm previously pending payments transition to `captured` or `failed` with receipts issued where appropriate.
3. **Retrospective**
   - Record the incident timeline, root cause, actions taken, and improvements into the incident log.
   - Raise follow-up tasks for additional alerts, circuit breakers, or provider contracts as needed.

## Preventative actions

- Maintain automated smoke tests for each provider in staging.
- Keep feature flags for each PSP/mobile-money route documented and regularly tested.
- Review SLAs with providers quarterly and ensure contact escalation trees are current.
