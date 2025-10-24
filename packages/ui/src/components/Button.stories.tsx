import type { Meta, StoryObj } from "@storybook/react";
import { Slot } from "@radix-ui/react-slot";

import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The Button component supports slot-based composition via Radix Slot and inherits shared EcoTrips theming tokens.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "glass"],
    },
    fullWidth: {
      control: "boolean",
    },
    asChild: {
      control: "boolean",
    },
  },
  args: {
    children: "Plan trip",
    variant: "primary",
    fullWidth: false,
    asChild: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Save itinerary",
  },
};

export const WithSlot: Story = {
  args: {
    asChild: true,
    children: (
      <Slot>
        <span className="flex items-center gap-2">
          <span aria-hidden role="img">
            ✈️
          </span>
          <span>Launch offer</span>
        </span>
      </Slot>
    ),
  },
};
