import type { Config } from 'tailwindcss';
import { icupaTailwindPreset } from '@icupa/config/tailwind-preset';

const config = {
  presets: [icupaTailwindPreset],
  darkMode: ['class', '.dark'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
} satisfies Config;

export default config;
