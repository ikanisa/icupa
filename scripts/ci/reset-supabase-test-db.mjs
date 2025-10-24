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
const SUPABASE_CLI = 'supabase';

function hasSupabaseCli() {
  const result = spawnSync(SUPABASE_CLI, ['--version'], {
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
  const projectRoot = resolve(dirname(configPath), '..');
  const cliArgs = ['--workdir', projectRoot, '--yes'];

  run(SUPABASE_CLI, [...cliArgs, 'db', 'reset']);
  console.info('[supabase] Local database reset (seeds run via config.sql_paths when enabled).');
} catch (error) {
  if (process.env.CI) {
    console.error('[supabase] Failed to reset local database:', error);
    process.exit(1);
  }
  console.warn('[supabase] Skipping database reset due to error:', error);
}
