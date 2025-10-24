import type { Config } from "tailwindcss";

const preset: Config = {
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--eco-font-sans)", "system-ui", "sans-serif"],
        display: ["var(--eco-font-display)", "var(--eco-font-sans)", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "rgb(var(--eco-color-brand) / <alpha-value>)",
          foreground: "rgb(var(--eco-color-brand-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--eco-color-accent) / <alpha-value>)",
          foreground: "rgb(var(--eco-color-accent-foreground) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--eco-color-surface) / <alpha-value>)",
          foreground: "rgb(var(--eco-color-surface-foreground) / <alpha-value>)",
        },
        muted: "rgb(var(--eco-color-muted) / <alpha-value>)",
        positive: "rgb(var(--eco-color-positive) / <alpha-value>)",
        negative: "rgb(var(--eco-color-negative) / <alpha-value>)",
        glass: {
          DEFAULT: "var(--eco-glass-bg)",
          border: "var(--eco-glass-border)",
        },
      },
      backgroundImage: {
        "eco-gradient-primary": "var(--eco-gradient-primary)",
        "eco-gradient-rwanda": "var(--eco-gradient-rwanda)",
      },
      borderRadius: {
        lg: "var(--eco-radius-lg)",
        xl: "var(--eco-radius-xl)",
        md: "var(--eco-radius-md)",
        sm: "var(--eco-radius-sm)",
      },
      transitionDuration: {
        fast: "var(--eco-duration-fast)",
        base: "var(--eco-duration-base)",
        slow: "var(--eco-duration-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--eco-easing-std)",
      },
      boxShadow: {
        glass: "var(--eco-glass-shadow)",
      },
      backdropBlur: {
        glass: "var(--eco-glass-blur)",
      },
    },
  },
};

export default preset;
