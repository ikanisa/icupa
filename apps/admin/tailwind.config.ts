import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: "#00D1FF",
        glass: "rgba(15, 23, 42, 0.88)",
      },
      fontFamily: {
        sans: ["'InterVariable'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
