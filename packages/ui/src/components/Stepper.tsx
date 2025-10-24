import { clsx } from "clsx";

type Step = {
  id: string;
  label: string;
  status: "pending" | "current" | "complete";
};

type StepperProps = {
  steps: Step[];
};

export function Stepper({ steps }: StepperProps) {
  return (
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={clsx(
            "rounded-2xl border p-4 text-sm transition-colors",
            step.status === "complete" && "border-positive/60 bg-positive/10 text-positive/90",
            step.status === "current" && "border-brand/60 bg-brand/10 text-brand/90",
            step.status === "pending" && "border-glass-border bg-glass text-muted",
          )}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
            <span>{index + 1}</span>
            <span>{step.status}</span>
          </div>
          <p className="mt-2 text-base font-semibold">{step.label}</p>
        </li>
      ))}
    </ol>
  );
}
