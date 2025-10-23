import { test } from '@playwright/test';
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

const repoRoot = path.resolve(__dirname, '../../..');
const rlsTests = readdirSync(path.join(repoRoot, 'supabase/tests'))
  .filter((file) => file.startsWith('rls_') && file.endsWith('.sql'))
  .sort();

test.describe('Supabase RLS SQL suites', () => {
  test.skip(!hasSupabaseCli(), 'Supabase CLI is required to execute SQL-based RLS tests.');

  for (const sqlTest of rlsTests) {
    test(`executes ${sqlTest}`, async () => {
      execSync(`supabase db test --file supabase/tests/${sqlTest}`, {
        cwd: repoRoot,
        stdio: 'pipe',
      });
    });
  }
});
