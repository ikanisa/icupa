"use client";

import { forwardRef, type ElementRef, type ComponentPropsWithoutRef } from "react";
import { Slot } from "@radix-ui/react-slot";

import { buttonClassName, type ButtonVariant } from "../styles/button";

type NativeButtonProps = ComponentPropsWithoutRef<"button">;

type ButtonProps = {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  asChild?: boolean;
} & Omit<NativeButtonProps, "children"> & {
    children?: NativeButtonProps["children"];
  };

type ButtonRef = ElementRef<"button">;

export const Button = forwardRef<ButtonRef, ButtonProps>(
  ({ className, variant = "primary", fullWidth, asChild = false, children, type, ...props }, ref) => {
    const classNameComputed = buttonClassName(variant, fullWidth, className);

    if (asChild) {
      return (
        <Slot ref={ref} className={classNameComputed} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button ref={ref} className={classNameComputed} type={type ?? "button"} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
