import type { Config } from "tailwindcss";
import preset from "./tailwind.preset";

const config: Config = {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "./stories/**/*.{ts,tsx}"]
};

export default config;
