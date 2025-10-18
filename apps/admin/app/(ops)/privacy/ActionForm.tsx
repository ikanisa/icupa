"use client";

import { useFormState, useFormStatus } from "react-dom";
import { buttonClassName, Toast } from "@ecotrips/ui";

export type ActionFormState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  detail?: string;
};

export type ActionField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
};

const initialState: ActionFormState = { status: "idle" };

type ActionFormProps = {
  action: (state: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  submitLabel: string;
  fields: ActionField[];
};

export function ActionForm({ action, submitLabel, fields }: ActionFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-2 text-sm">
            <span>{field.label}</span>
            <input
              name={field.name}
              placeholder={field.placeholder}
              type={field.type ?? "text"}
              defaultValue={field.defaultValue}
              required={field.required}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
        ))}
        <button type="submit" className={buttonClassName("glass")} disabled={pending}>
          {pending ? `${submitLabel}…` : submitLabel}
        </button>
      </form>
      <ActionStatus state={state} />
    </div>
  );
}

type ActionStatusProps = { state: ActionFormState };

function ActionStatus({ state }: ActionStatusProps) {
  if (state.status === "idle") return null;
  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  return (
    <Toast
      id={`privacy-action-${tone}`}
      title={
        state.status === "success"
          ? "Action completed"
          : state.status === "offline"
            ? "Authentication required"
            : "Action failed"
      }
      description={state.detail ?? state.message ?? "Check withObs logs for details."}
      onDismiss={() => undefined}
    />
  );
}
