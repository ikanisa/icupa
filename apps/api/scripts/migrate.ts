import { execSync } from 'node:child_process';

export const migrate = () => {
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname });
};

migrate();
