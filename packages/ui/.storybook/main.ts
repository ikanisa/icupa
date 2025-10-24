import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../src/**/*.mdx"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  viteFinal: async (config) => {
    const alias = config.resolve?.alias ?? [];
    const aliasArray = Array.isArray(alias)
      ? alias
      : Object.entries(alias).map(([find, replacement]) => ({ find, replacement }));
    aliasArray.push(
      {
        find: "next/link",
        replacement: resolve(__dirname, "next-link.tsx"),
      },
      {
        find: "next/navigation",
        replacement: resolve(__dirname, "next-navigation.ts"),
      },
    );
    config.resolve = config.resolve ?? {};
    config.resolve.alias = aliasArray;
    return config;
  },
};

export default config;
