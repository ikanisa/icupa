import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

function resolveSupabaseWorkdir(): string | undefined {
  const repoRoot = path.resolve(__dirname, '../../..');
  const candidates = [
    path.join(repoRoot, 'tmp-supabase-config', 'supabase', 'config.toml'),
    path.join(repoRoot, 'supabase', 'config.toml'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  return match ? path.dirname(path.dirname(match)) : undefined;
}

function canRunSupabaseDbTests(): boolean {
  const workdir = resolveSupabaseWorkdir();
  if (!workdir) {
    return false;
  }

  try {
    execFileSync('supabase', ['--version'], { stdio: 'ignore' });
    execFileSync('supabase', ['--workdir', workdir, 'status'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const repoRoot = path.resolve(__dirname, '../../..');
const supabaseWorkdir = resolveSupabaseWorkdir();
const rlsTests = readdirSync(path.join(repoRoot, 'supabase/tests'))
  .filter((file) => file.startsWith('rls_') && file.endsWith('.sql'))
  .sort();

function buildArgs(sqlFile: string): string[] {
  const args: string[] = [];
  if (supabaseWorkdir) {
    args.push('--workdir', supabaseWorkdir);
  }
  args.push('db', 'test', `supabase/tests/${sqlFile}`, '--local', '--yes');
  return args;
}

test.describe('Supabase RLS SQL suites', () => {
  test.skip(!canRunSupabaseDbTests(), 'Supabase CLI is required to execute SQL-based RLS tests.');

  for (const sqlTest of rlsTests) {
    test(`executes ${sqlTest}`, async () => {
      execFileSync('supabase', buildArgs(sqlTest), { cwd: repoRoot, stdio: 'pipe' });
    });
  }
});
