import type { Preview } from "@storybook/react";

import "../src/styles/tailwind.css";
import "../src/styles/tokens.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "rgb(var(--eco-color-surface) / 1)" },
        { name: "glass", value: "var(--eco-glass-bg)" },
      ],
    },
  },
};

export default preview;
