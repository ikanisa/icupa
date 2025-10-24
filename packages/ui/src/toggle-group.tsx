import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(function ToggleGroup({ type = "single", ...props }, ref) {
  return <ToggleGroupPrimitive.Root ref={ref} type={type as any} {...props} />;
});

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(function ToggleGroupItem(props, ref) {
  return <ToggleGroupPrimitive.Item ref={ref} {...props} />;
});

export { ToggleGroup, ToggleGroupItem, ToggleGroupPrimitive };
export type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>;
export type ToggleGroupItemProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>;
