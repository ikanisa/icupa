"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

const baseStyles =
  "inline-flex h-12 w-12 items-center justify-center rounded-full border border-glass-border bg-glass text-surface-foreground/90 transition-all duration-[var(--eco-duration-base)] ease-[var(--eco-easing-std)] hover:bg-surface/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      data-active={active}
      className={clsx(
        baseStyles,
        active && "border-brand/70 bg-brand/10 text-brand ring-2 ring-brand/40",
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
