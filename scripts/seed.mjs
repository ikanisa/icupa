import { execSync } from 'node:child_process';

execSync('pnpm --filter @icupa/api exec tsx scripts/seed.ts', { stdio: 'inherit' });
