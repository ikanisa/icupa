"use client";

import { forwardRef } from "react";
import type * as React from "react";
import type { ComponentType } from "react";
import { Slot } from "@radix-ui/react-slot";

import { buttonClassName, type ButtonVariant } from "../styles/button";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth, asChild, children, type, ...props }, ref) => {
    const classNameComputed = buttonClassName(variant, fullWidth, className);
    const childNodes = children as unknown as React.ReactNode;
    const SlotPrimitive = Slot as unknown as ComponentType<any>;

    if (asChild) {
      return (
        <SlotPrimitive className={classNameComputed} {...props}>
          {/* @ts-ignore: workspace-linked react types disagree but runtime is correct */}
          {childNodes}
        </SlotPrimitive>
      );
    }

    return (
      <button ref={ref} className={classNameComputed} type={type ?? "button"} {...props}>
        {/* @ts-ignore: workspace-linked react types disagree but runtime is correct */}
        {childNodes}
      </button>
    );
  },
);

Button.displayName = "Button";
