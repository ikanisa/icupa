import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      enabled: false,
      reporter: ['text', 'json', 'html'],
      statements: 0.8,
      branches: 0.8,
      functions: 0.8,
      lines: 0.8
    }
  },
  resolve: {
    alias: {
      '@icupa/domain': resolve(rootDir, '../../packages/domain/src/index.ts')
    }
  }
});
