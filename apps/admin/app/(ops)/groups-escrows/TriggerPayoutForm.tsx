"use client";

import { useFormState, useFormStatus } from "react-dom";
import { buttonClassName, Toast } from "@ecotrips/ui";

type PayoutFormState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  requestId?: string;
};

const initialState: PayoutFormState = { status: "idle" };

type TriggerPayoutFormProps = {
  action: (state: PayoutFormState, formData: FormData) => Promise<PayoutFormState>;
  lastEscrowId?: string;
};

export function TriggerPayoutForm({ action, lastEscrowId }: TriggerPayoutFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <label className="flex flex-col gap-2 text-sm">
          <span>Escrow ID</span>
          <input
            name="escrowId"
            defaultValue={lastEscrowId}
            placeholder="uuid for group escrow"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <SubmitButton pending={pending} />
      </form>
      <PayoutStatus state={state} />
    </div>
  );
}

type SubmitButtonProps = { pending: boolean };

function SubmitButton({ pending }: SubmitButtonProps) {
  return (
    <button type="submit" className={buttonClassName("glass")} disabled={pending}>
      {pending ? "Triggering payout…" : "Trigger payout"}
    </button>
  );
}

type PayoutStatusProps = { state: PayoutFormState };

function PayoutStatus({ state }: PayoutStatusProps) {
  if (state.status === "idle") {
    return null;
  }

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";

  return (
    <Toast
      id={`groups-payout-${tone}`}
      title={state.status === "success" ? "Payout orchestrated" : state.status === "offline" ? "Auth required" : "Payout failed"}
      description={state.message ?? "Check withObs logs for request telemetry."}
      onDismiss={() => undefined}
    />
  );
}
