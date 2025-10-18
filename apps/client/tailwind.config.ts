import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../**/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00D1FF",
        accent: "#7C3AED",
        glass: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        sans: ["'InterVariable'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
