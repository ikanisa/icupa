import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link", "gradient", "glass", "aurora"],
    },
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "default", "lg", "icon"],
    },
  },
  args: {
    children: "Explore ICUPA",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Playground: Story = {};

export const Loading: Story = {
  args: {
    disabled: true,
    children: "Loading…",
  },
};
