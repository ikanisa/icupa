import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        supplier: {
          primary: "#34d399",
          surface: "#0f172a",
          accent: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["'InterVariable'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
