# WhatsApp Templates (initial request list)

| Template | Purpose | Notes |
|----------|---------|-------|
| ITIN_SUMMARY | Send itinerary highlights + day plan summary. | Variables: traveler name, trip dates, top activities. |
| PAYMENT_LINK | Deliver secure checkout/payment link reminder. | Variables: amount, currency, link expiry. |
| GROUP_INVITE | Invite friends to join split-pay group with CTA. | Variables: host name, group target, deadline. |
| SUPPORT_ESCALATION | Confirm support ticket creation/escalation details. | Variables: ticket id, summary, next action. |

Each template body should remain under 1024 characters and include fallback copy for localized variants.

## Template Payload Shapes

### ITIN_SUMMARY
Quick summary of planned itinerary with primary quick replies.

```json
{
  "name": "ITIN_SUMMARY",
  "language": "en",
  "components": {
    "body_text": "Here is your 7-day Rwanda plan. Ready to move forward?",
    "buttons": [
      { "id": "pay_now", "text": "Pay" },
      { "id": "group_invite", "text": "Group Save" }
    ]
  }
}
```

Webhook payloads we consume will include `interactive.button_reply.id` values of `pay_now` or `group_invite`.

### PAYMENT_LINK
Checkout handoff once the traveler confirms.

```json
{
  "name": "PAYMENT_LINK",
  "language": "en",
  "components": {
    "body_text": "Tap below to open your secure checkout.",
    "buttons": [
      { "id": "open_checkout", "text": "Open Checkout" }
    ]
  }
}
```

The WhatsApp button reply will come back with `interactive.button_reply.id = "open_checkout"`.

### GROUP_INVITE
Used when inviting friends into a savings circle.

```json
{
  "name": "GROUP_INVITE",
  "language": "en",
  "components": {
    "body_text": "Invite friends to split the trip. Ready to join?",
    "buttons": [
      { "id": "join_group", "text": "Join" },
      { "id": "skip_group", "text": "Skip" }
    ]
  }
}
```

Webhook replies surface `interactive.button_reply.id` of `join_group` or `skip_group` which we use to drive the state machine.

### SUPPORT_ESCALATION
Escalation safety valve for travelers needing human help.

```json
{
  "name": "SUPPORT_ESCALATION",
  "language": "en",
  "components": {
    "body_text": "Need help? Tap to reach support.",
    "buttons": [
      { "id": "contact_support", "text": "Contact Support" }
    ]
  }
}
```

Interactive replies send `interactive.button_reply.id = "contact_support"`, which routes to the support channel.

## Link Notices (non-template)
- Use the `wa-send` function with `"type": "link_notice"` to deliver ad-hoc links (e.g., invoices or credit notes).
- Payload shape:

```json
{
  "type": "link_notice",
  "to": "2507XXXXXXXX",
  "text": "Your ecoTrips invoice",
  "url": "https://woyknezboamabahknmjr.supabase.co/storage/v1/object/sign/invoices/INV..."
}
```

- In offline mode (`WA_OFFLINE=1`) the handler stores and logs the message instead of calling the Graph API.
