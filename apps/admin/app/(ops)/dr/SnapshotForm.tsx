"use client";

import { AdminActionForm, type AdminActionField, type AdminActionState } from "@ecotrips/ui";

export type SnapshotState = AdminActionState & {
  detail?: string;
};

const initialState: SnapshotState = { status: "idle" };

const fields: AdminActionField[] = [
  { name: "label", label: "Label", placeholder: "weekly-dr", required: true },
  {
    name: "tables",
    label: "Tables (optional comma list)",
    placeholder: "core.profiles,booking.itineraries",
  },
];

type SnapshotFormProps = {
  action: (state: SnapshotState, formData: FormData) => Promise<SnapshotState>;
};

export function SnapshotForm({ action }: SnapshotFormProps) {
  return (
    <AdminActionForm
      action={action}
      initialState={initialState}
      submitLabel="Create snapshot"
      pendingLabel="Creating…"
      fields={fields}
      toastId="dr-snapshot"
      successTitle="Snapshot complete"
      errorTitle="Snapshot failed"
      offlineTitle="Authentication required"
      defaultDescription="Review withObs logs for drill diagnostics."
    />
  );
}
