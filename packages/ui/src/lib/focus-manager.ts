import type { MutableRefObject, Ref } from "react";

export const focusFirstDescendant = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }

  const focusableSelectors = [
    "[data-autofocus]",
    "button:not([disabled])",
    "[href]",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];

  const candidate = element.querySelector<HTMLElement>(focusableSelectors.join(","));
  candidate?.focus();
};

export const composeRefs = <T>(...refs: Array<Ref<T> | undefined>): ((instance: T | null) => void) => {
  return (instance) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(instance);
        continue;
      }
      try {
        (ref as MutableRefObject<T | null>).current = instance;
      } catch {
        // ignore
      }
    }
  };
};
