# Abuse Taxonomy

This taxonomy enumerates the abuse surfaces ecoTrips agents must monitor. Each
category includes an escalation policy that should be reflected in moderation
responses, audit trails, and any human-in-the-loop hand-offs.

## 1. Threats & Violence
- **Definition:** Direct or implied threats of physical harm, terrorism,
  self-harm encouragement, or instructions to commit violence.
- **Action:** `escalate`
  - Immediately route to human operators.
  - Freeze automated actions and record the request ID plus contextual snippet in
    the audit log.

## 2. Hate & Harassment
- **Definition:** Slurs, demeaning stereotypes, or targeted harassment against
  protected groups or individuals.
- **Action:** `refuse`
  - Refuse to comply and warn the user of policy boundaries.
  - Capture the refusal event with the offending category for compliance review.

## 3. Sexual Content
- **Definition:** Explicit sexual descriptions, pornography, or adult service
  solicitations unrelated to ecoTrips offerings.
- **Action:** `refuse`
  - Decline the request with a brief policy reminder.
  - Store the refusal metadata without verbatim content whenever possible.

## 4. Child Safety
- **Definition:** Any sexual content involving minors, exploitation, or requests
  that could endanger children.
- **Action:** `escalate`
  - Trigger an immediate human escalation workflow.
  - Do not surface the content back to users; summarize for investigators only.

## 5. Self-Harm & Crisis
- **Definition:** Admissions of intent to self-harm or suicide, or requests for
  instructions encouraging self-harm.
- **Action:** `escalate`
  - Provide empathetic crisis resources if available.
  - Escalate to trained operators with relevant metadata and timestamps.

## 6. Dangerous Acts & Illegal Activity
- **Definition:** Requests for instructions that facilitate crime, weapons,
  hacking, or other clearly illegal acts.
- **Action:** `refuse`
  - Decline and cite policy; recommend lawful alternatives if appropriate.
  - Log the refusal for subsequent analytics.

## 7. Spam & Fraud
- **Definition:** Bulk messaging, phishing attempts, or payment fraud signals.
- **Action:** `refuse`
  - Halt automated processing and alert fraud monitoring tools.
  - Document any associated identifiers or payment references.

## 8. Misinformation with Safety Impact
- **Definition:** Travel advisories or health guidance that contradict trusted
  sources and could endanger travelers.
- **Action:** `escalate`
  - Escalate to content reviewers for fact-checking.
  - Annotate logs with the disputed claim and relevant agent session.

## 9. Benign / No Abuse
- **Definition:** Content that passes automated and human checks.
- **Action:** `allow`
  - Continue regular agent execution.
  - Maintain lightweight audit metadata for completeness.

When multiple categories apply, defer to the highest-severity action (e.g.
`escalate` overrides `refuse`). These prescriptions should be mirrored by the
Supabase moderation function and the agent orchestrator to keep policy
decisions observable and reviewable.
