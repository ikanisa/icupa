import type { Meta, StoryObj } from "@storybook/react";

import { CardGlass } from "./CardGlass";

const meta = {
  title: "Components/CardGlass",
  component: CardGlass,
  tags: ["autodocs"],
  args: {
    title: "Volcano trek",
    subtitle: "4 days exploring Nyiragongo's crater",
    children: (
      <>
        <p>Pack for cool nights at the summit and bring a reliable torch.</p>
        <p className="text-xs text-muted">Guided departures twice per week.</p>
      </>
    ),
  },
} satisfies Meta<typeof CardGlass>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    actions: <button className="text-sm font-semibold text-brand-foreground">Edit</button>,
  },
};
