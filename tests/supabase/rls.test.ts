import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

function hasSupabaseCli(): boolean {
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function supabaseStackOnline(): boolean {
  try {
    execSync('supabase status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const rlsTests = readdirSync(path.resolve('supabase/tests'))
  .filter((file) => file.startsWith('rls_') && file.endsWith('.sql'))
  .sort();

describe('Supabase RLS regressions', () => {
  if (!hasSupabaseCli()) {
    it.skip('requires the Supabase CLI to execute SQL regression tests', () => {
      expect(true).toBe(true);
    });
    return;
  }

  if (!supabaseStackOnline()) {
    it.skip('requires the local Supabase stack to be running (supabase start)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const sqlTest of rlsTests) {
    it(`passes ${sqlTest}`, () => {
      const cwd = path.resolve('.');
      const target = path.posix.join('supabase/tests', sqlTest);
      execSync(`supabase db test ${target}`, {
        cwd,
        stdio: 'pipe',
      });
    });
  }
});
