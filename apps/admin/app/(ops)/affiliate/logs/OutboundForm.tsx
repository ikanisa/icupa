"use client";

import { AdminActionForm, type AdminActionField, type AdminActionState } from "@ecotrips/ui";

export type AffiliateOutboundState = AdminActionState;

const initialState: AffiliateOutboundState = { status: "idle" };

const fields: AdminActionField[] = [
  {
    name: "partner",
    label: "Partner slug",
    placeholder: "acme-travel",
    required: true,
  },
  {
    name: "event",
    label: "Event type",
    placeholder: "booking.created",
    required: true,
  },
  {
    name: "payload",
    label: "Payload (JSON)",
    placeholder: '{"id":"evt_123","status":"pending"}',
    type: "textarea",
  },
  {
    name: "note",
    label: "Operator note",
    placeholder: "Optional audit note",
  },
];

type OutboundFormProps = {
  action: (state: AffiliateOutboundState, formData: FormData) => Promise<AffiliateOutboundState>;
};

export function OutboundForm({ action }: OutboundFormProps) {
  return (
    <AdminActionForm
      action={action}
      initialState={initialState}
      submitLabel="Simulate outbound"
      pendingLabel="Simulating…"
      fields={fields}
      toastId="affiliate-outbound"
      successTitle="Notification simulated"
      errorTitle="Simulation failed"
      offlineTitle="Authentication required"
      defaultDescription="Inspect affiliate.events for full payload." 
    />
  );
}
