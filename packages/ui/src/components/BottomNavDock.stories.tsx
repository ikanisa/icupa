import type { Meta, StoryObj } from "@storybook/react";

import { BottomNavDock } from "./BottomNavDock";

const meta = {
  title: "Components/BottomNavDock",
  component: BottomNavDock,
  tags: ["autodocs"],
  args: {
    activePath: "/trips",
    items: [
      { label: "Home", href: "/", icon: "🏠" },
      { label: "Trips", href: "/trips", icon: "🗺️" },
      { label: "Messages", href: "/messages", icon: "💬" },
      { label: "Profile", href: "/profile", icon: "👤" },
    ],
  },
  parameters: {
    docs: {
      description: {
        component:
          "Mobile navigation dock that highlights the active route. Provide `activePath` for environments without Next.js routing.",
      },
    },
  },
} satisfies Meta<typeof BottomNavDock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
