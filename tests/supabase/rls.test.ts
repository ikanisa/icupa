import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

function resolveSupabaseWorkdir(): string | undefined {
  const repoRoot = path.resolve('.');
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

const supabaseWorkdir = resolveSupabaseWorkdir();
const rlsTests = readdirSync(path.resolve('supabase/tests'))
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

describe('Supabase RLS regressions', () => {
  if (!canRunSupabaseDbTests()) {
    it.skip('requires the Supabase CLI to execute SQL regression tests', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const sqlTest of rlsTests) {
    it(`passes ${sqlTest}`, () => {
      execFileSync('supabase', buildArgs(sqlTest), {
        cwd: path.resolve('.'),
        stdio: 'pipe',
      });
    });
  }
});
