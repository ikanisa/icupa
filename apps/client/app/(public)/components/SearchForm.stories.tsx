import type { Meta, StoryObj } from "@storybook/react";

import { SearchForm } from "./SearchForm";

const meta: Meta<typeof SearchForm> = {
  title: "Public/SearchForm",
  component: SearchForm,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof SearchForm>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <SearchForm />
    </div>
  ),
};
