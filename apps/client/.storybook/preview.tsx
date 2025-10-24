import type { Preview } from "@storybook/react";
import React from "react";

import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import { AppProviders } from "../app/(public)/providers/AppProviders";

const preview: Preview = {
  decorators: [
    (Story) => (
      <AppProviders>
        <div className="min-h-screen bg-slate-950 p-6 text-white">
          <Story />
        </div>
      </AppProviders>
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
    backgrounds: {
      default: "night",
      values: [
        { name: "night", value: "#020617" },
        { name: "glass", value: "linear-gradient(135deg, rgba(14,116,144,0.6), rgba(30,64,175,0.6))" },
      ],
    },
    a11y: {
      element: "#root",
    },
  },
};

export default preview;
