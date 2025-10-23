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

function captureOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function hasSupabaseCli() {
  const result = spawnSync('supabase', ['--version'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function getSupabaseVersion() {
  const result = spawnSync('supabase', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0) {
    return (result.stdout || result.stderr || '').trim();
  }
  return undefined;
}

function resolveWorkdir(configFile) {
  if (!configFile) {
    return undefined;
  }
  // config lives in <workdir>/supabase/config.toml
  return dirname(dirname(configFile));
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
  console.warn('[supabase] Supabase CLI is not available. Run `npm install` or `npx supabase@latest` to enable automated resets.');
  process.exit(0);
}

try {
  const workdir = resolveWorkdir(configPath);
  const resetHelp = captureOutput('supabase', ['db', 'reset', '--help']);
  const supportsConfigFlag = resetHelp.includes('--config');
  const supportsYesFlag = resetHelp.includes('--yes');
  const supportsNoConfirmFlag = resetHelp.includes('--no-confirm');
  const supabaseVersion = getSupabaseVersion();

  const args = [];
  if (supportsConfigFlag && configPath) {
    args.push('db', 'reset', '--config', configPath);
    if (supportsNoConfirmFlag) {
      args.push('--no-confirm');
    }
  } else if (workdir) {
    args.push('--workdir', workdir, 'db', 'reset', '--local');
    if (supportsYesFlag) {
      args.push('--yes');
    } else if (supportsNoConfirmFlag) {
      args.push('--no-confirm');
    } else {
      const versionSuffix = supabaseVersion ? ` (${supabaseVersion})` : '';
      console.warn(`[supabase] Installed CLI${versionSuffix} does not support non-interactive resets. Skipping automated reset.`);
      process.exit(0);
    }
  } else {
    console.warn('[supabase] Unable to determine Supabase workdir. Skipping automated reset.');
    process.exit(0);
  }

  run('supabase', args);

  if (existsSync(seedFile)) {
    const rootHelp = captureOutput('supabase', ['--help']);
    if (rootHelp.includes('\n  seed')) {
      const seedArgs = [];
      if (!supportsConfigFlag && workdir) {
        seedArgs.push('--workdir', workdir);
      }
      seedArgs.push('seed', '--local');
      if (supportsYesFlag) {
        seedArgs.push('--yes');
      }
      run('supabase', seedArgs);
    }
  }

  console.info('[supabase] Local database reset and seeded.');
} catch (error) {
  if (process.env.CI) {
    console.error('[supabase] Failed to reset local database:', error);
    process.exit(1);
  }
  console.warn('[supabase] Skipping database reset due to error:', error);
}
