"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { buttonClassName } from "../styles/button";
import { Toast } from "./Toast";

export type AdminActionState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  detail?: string;
};

export type AdminActionFieldOption = {
  label: string;
  value: string;
};

export type AdminActionField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "textarea" | "select";
  defaultValue?: string;
  required?: boolean;
  options?: AdminActionFieldOption[];
};

export type AdminActionFormProps<State extends AdminActionState> = {
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  submitLabel: string;
  pendingLabel?: string;
  fields: AdminActionField[];
  renderStatus?: (state: State) => ReactNode;
  toastId?: string;
  successTitle?: string;
  errorTitle?: string;
  offlineTitle?: string;
  defaultDescription?: string;
};

export function AdminActionForm<State extends AdminActionState>({
  action,
  initialState,
  submitLabel,
  pendingLabel,
  fields,
  renderStatus,
  toastId = "admin-action-toast",
  successTitle = "Action completed",
  errorTitle = "Action failed",
  offlineTitle = "Authentication required",
  defaultDescription = "Check withObs logs for details.",
}: AdminActionFormProps<State>) {
  const [state, formAction] = useFormState(action, initialState);
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        {fields.map((field) => (
          <FieldControl key={field.name} field={field} />
        ))}
        <button type="submit" className={buttonClassName("glass")} disabled={pending}>
          {pending ? pendingLabel ?? `${submitLabel}…` : submitLabel}
        </button>
      </form>
      {renderStatus ? renderStatus(state) : <DefaultStatusToast state={state} toastId={toastId} successTitle={successTitle} errorTitle={errorTitle} offlineTitle={offlineTitle} defaultDescription={defaultDescription} />}
    </div>
  );
}

type FieldControlProps = {
  field: AdminActionField;
};

function FieldControl({ field }: FieldControlProps) {
  const baseClassName =
    "rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400";

  if (field.type === "textarea") {
    return (
      <label className="flex flex-col gap-2 text-sm">
        <span>{field.label}</span>
        <textarea
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
          defaultValue={field.defaultValue}
          className={`${baseClassName} min-h-[112px]`}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="flex flex-col gap-2 text-sm">
        <span>{field.label}</span>
        <select
          name={field.name}
          defaultValue={field.defaultValue}
          required={field.required}
          className={baseClassName}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span>{field.label}</span>
      <input
        name={field.name}
        placeholder={field.placeholder}
        type={field.type ?? "text"}
        defaultValue={field.defaultValue}
        required={field.required}
        className={baseClassName}
      />
    </label>
  );
}

type DefaultStatusToastProps = {
  state: AdminActionState;
  toastId: string;
  successTitle: string;
  errorTitle: string;
  offlineTitle: string;
  defaultDescription: string;
};

function DefaultStatusToast({ state, toastId, successTitle, errorTitle, offlineTitle, defaultDescription }: DefaultStatusToastProps) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const title = state.status === "success" ? successTitle : state.status === "offline" ? offlineTitle : errorTitle;
  const description = state.detail ?? state.message ?? defaultDescription;

  return (
    <Toast id={`${toastId}-${tone}`} title={title} description={description} onDismiss={() => undefined} />
  );
}
