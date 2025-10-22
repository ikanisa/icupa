import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const candidateConfigs = [
  resolve(repoRoot, 'tmp-supabase-config/supabase/config.toml'),
  resolve(repoRoot, 'supabase/config.toml'),
];
const configPath = candidateConfigs.find((path) => existsSync(path));
const seedFile = resolve(repoRoot, 'supabase/seed/seed.sql');

function hasSupabaseCli() {
  const result = spawnSync('supabase', ['--version'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

if (!configPath) {
  console.warn('[supabase] No config.toml found. Skipping automated reset.');
  process.exit(0);
}

if (!hasSupabaseCli()) {
  console.warn('[supabase] Supabase CLI is not available. Install it to enable automated resets.');
  process.exit(0);
}

try {
  run('supabase', ['db', 'reset', '--config', configPath, '--no-confirm']);
  if (existsSync(seedFile)) {
    run('supabase', ['db', 'execute', '--file', seedFile, '--config', configPath]);
  }
  console.info('[supabase] Local database reset and seeded.');
} catch (error) {
  if (process.env.CI) {
    console.error('[supabase] Failed to reset local database:', error);
    process.exit(1);
  }
  console.warn('[supabase] Skipping database reset due to error:', error);
}
