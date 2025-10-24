import type { Meta, StoryObj } from "@storybook/react";

import { Stepper } from "./Stepper";

const meta = {
  title: "Components/Stepper",
  component: Stepper,
  tags: ["autodocs"],
  args: {
    steps: [
      { id: "itinerary", label: "Curate itinerary", status: "complete" },
      { id: "budget", label: "Confirm budget", status: "current" },
      { id: "bookings", label: "Finalize bookings", status: "pending" },
    ],
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
