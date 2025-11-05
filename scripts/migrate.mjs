import { execSync } from 'node:child_process';

execSync('pnpm --filter @icupa/api exec tsx scripts/migrate.ts', { stdio: 'inherit' });
execSync('pnpm --filter @icupa/api exec tsx src/presentation/http/openapi.ts', { stdio: 'inherit' });
