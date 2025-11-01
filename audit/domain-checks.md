# Domain Readiness Checklist

## Real Estate & Rentals
- Map integrations absent; need provider vetting (Mapbox/Google) and licensing.
- Availability calendars not implemented; add ICS export/import and conflict resolution.
- Escrow/payment flows missing; require compliance with rental regulations (KYC, deposits).

## Pharmacies
- No medication catalog or substitution logic; need controlled substance guardrails.
- OTP login insufficient for PHI; require MFA + audit logging, HIPAA consent, pharmacist verification workflow.
- Add medication disclaimer and adverse interaction checks (OpenFDA integration).

## Hardware/Automotive
- Inventory screens exist but use mock data; need SKU compatibility matrix, warranty tracking, return workflow.
- Provide BOM import/export and supplier pricing guardrails.

## Salons & Services
- Scheduling UI missing timezone awareness; implement ICS integration and cancellation policy handling.
- Add no-show fee enforcement and waitlist support.

## Tourism/Travel
- Multi-currency support absent; implement FX rates (daily) and price rounding rules per locale.
- Cancellation policies not modeled; need tiered policy builder and traveler communication flows.
- Integrate tax/VAT per region; ensure receipts include required disclosures.

## Payments & Mobile Money
- Supabase functions reference WhatsApp OTP but no explicit payment provider integration; define idempotent webhook handlers (MoMo, Stripe, etc.).
- Add reconciliation jobs with DLQ + retriable webhook processing.

## Compliance Actions
1. Produce per-vertical runbooks and regulatory checklists.
2. Engage legal/compliance to review tenant onboarding flows.
3. Build data retention + consent storage per vertical.
4. Add monitoring for agent actions impacting regulated domains (pharmacy recommendations, travel bookings).
