"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

const baseStyles =
  "inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition-all hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400";

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      data-active={active}
      className={clsx(
        baseStyles,
        active && "border-sky-400/70 bg-white/20 text-sky-200 shadow-lg shadow-sky-500/40",
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
