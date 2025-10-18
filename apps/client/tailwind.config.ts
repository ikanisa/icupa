import type { Config } from 'tailwindcss';
import { icupaTailwindPreset } from '@icupa/config/tailwind-preset';

const config: Config = {
  presets: [icupaTailwindPreset],
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './stores/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      backdropBlur: {
        glass: '24px',
      },
      boxShadow: {
        aurora: '0 24px 80px rgba(12, 8, 32, 0.35)',
      },
    },
  },
};

export default config;
