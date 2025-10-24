import type { Meta, StoryObj } from "@storybook/react";

import { Toast } from "./Toast";

const meta = {
  title: "Components/Toast",
  component: Toast,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Accessible toast notification with polite live region announcements.",
      },
    },
  },
  args: {
    id: "storybook-toast",
    title: "Payment received",
    description: "We'll email your updated confirmation shortly.",
    intent: "info",
    durationMs: 120000,
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Success: Story = {
  args: {
    intent: "success",
    title: "Saved",
    description: "We synced the itinerary with your calendar.",
  },
};

export const Error: Story = {
  args: {
    intent: "error",
    title: "Connection issue",
    description: "Retry once you reconnect to the network.",
  },
};
