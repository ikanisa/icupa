"use client";

import { useFormState, useFormStatus } from "react-dom";
import { buttonClassName, Toast } from "@ecotrips/ui";

type SnapshotState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  detail?: string;
};

const initialState: SnapshotState = { status: "idle" };

type SnapshotFormProps = {
  action: (state: SnapshotState, formData: FormData) => Promise<SnapshotState>;
};

export function SnapshotForm({ action }: SnapshotFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <label className="flex flex-col gap-2 text-sm">
          <span>Label</span>
          <input
            name="label"
            placeholder="weekly-dr"
            required
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Tables (optional comma list)</span>
          <input
            name="tables"
            placeholder="core.profiles,booking.itineraries"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <button type="submit" className={buttonClassName("glass")} disabled={pending}>
          {pending ? "Creating…" : "Create snapshot"}
        </button>
      </form>
      <SnapshotStatus state={state} />
    </div>
  );
}

type SnapshotStatusProps = { state: SnapshotState };

function SnapshotStatus({ state }: SnapshotStatusProps) {
  if (state.status === "idle") return null;
  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  return (
    <Toast
      id={`dr-snapshot-${tone}`}
      title={state.status === "success" ? "Snapshot complete" : state.status === "offline" ? "Authentication required" : "Snapshot failed"}
      description={state.detail ?? state.message ?? "Review withObs logs for drill diagnostics."}
      onDismiss={() => undefined}
    />
  );
}
