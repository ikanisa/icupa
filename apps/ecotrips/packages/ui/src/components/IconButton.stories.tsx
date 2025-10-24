import type { Meta, StoryObj } from "@storybook/react";

import { IconButton } from "./IconButton";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Icon-only button variant for compact navigation and quick actions.",
      },
    },
  },
  args: {
    "aria-label": "Like",
    children: "❤️",
    active: false,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Active: Story = {
  args: {
    active: true,
  },
};
