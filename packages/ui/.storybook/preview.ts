import type { Preview } from "@storybook/react";
import React from "react";
import "../src/styles.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="bg-background text-foreground min-h-screen p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    a11y: {
      element: "#storybook-root",
      config: {
        rules: [{ id: "color-contrast", reviewOnFail: true }],
      },
    },
  },
};

export default preview;
