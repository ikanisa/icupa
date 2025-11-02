import type { Config } from 'tailwindcss';
import { icupaTailwindPreset } from '@icupa/config/tailwind-preset';

const config: Config = {
  presets: [icupaTailwindPreset],
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
};

export default config;
