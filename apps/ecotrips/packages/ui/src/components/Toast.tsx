"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

type ToastIntent = "success" | "error" | "info";

type ToastProps = {
  id: string;
  title: string;
  description?: string;
  intent?: ToastIntent;
  durationMs?: number;
  onDismiss?: () => void;
};

const intentClasses: Record<ToastIntent, string> = {
  success: "border-positive/70 bg-positive/20 text-positive/95",
  error: "border-negative/70 bg-negative/20 text-negative/95",
  info: "border-brand/70 bg-brand/15 text-brand/95",
};

export function Toast({
  id,
  title,
  description,
  intent = "info",
  durationMs = 5000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timeout);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-toast-id={id}
      className={clsx(
        "w-full rounded-2xl border px-4 py-3 shadow-lg backdrop-blur",
        intentClasses[intent],
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 text-xs opacity-80">{description}</p>}
    </div>
  );
}
