import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import { icupaTailwindPreset } from '@icupa/config/tailwind-preset';

const config = {
  presets: [icupaTailwindPreset],
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6b5bff',
          foreground: '#f8f9ff',
        },
        secondary: {
          DEFAULT: '#23c6d7',
          foreground: '#042430',
        },
        glass: 'rgba(255, 255, 255, 0.08)',
      },
      backdropBlur: {
        glass: '24px',
      },
      boxShadow: {
        glass: '0 24px 80px rgba(12, 8, 32, 0.35)',
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'aurora-pan': 'aurora 18s ease infinite',
        'fade-up': 'fadeUp 400ms ease forwards',
      },
      keyframes: {
        aurora: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0px)' },
        },
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('no-motion', '@media (prefers-reduced-motion: reduce)');
    }),
  ],
} satisfies Config;

export default config;
