#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

const requiredEnv = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase project URL (public)'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anon key (public)'],
  ['VITE_SUPABASE_URL', 'Supabase project URL for Vite'],
  ['VITE_SUPABASE_ANON_KEY', 'Supabase anon key for Vite'],
];

const missing = requiredEnv
  .map(([key, description]) => ({ key, description, value: process.env[key] }))
  .filter(({ value }) => !value || `${value}`.trim().length === 0);

if (missing.length > 0) {
  console.error('\n[ENV] Missing required variables:');
  for (const { key, description } of missing) {
    console.error(`  - ${key}: ${description}`);
  }
  console.error('\nPopulate the variables listed above (see audit/env-matrix.csv) before running the preflight.');
  process.exit(1);
}

const run = (command, options = {}) => {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: 'inherit', ...options });
};

try {
  run('node -v');
  run('npm --version');
  run('npx vercel --version');
} catch (error) {
  console.error('\n[ENV] Unable to determine tooling versions. Ensure Node.js 20.11.1+, npm, and the Vercel CLI are installed.');
  throw error;
}

const buildTargets = [
  { name: 'vite-root', command: 'npm run build', cwd: process.cwd() },
  { name: 'next-admin', command: 'npm run build --workspace @icupa/admin', cwd: process.cwd() },
  { name: 'next-client', command: 'npm run build --workspace @icupa/client', cwd: process.cwd() },
  { name: 'next-vendor', command: 'npm run build --workspace @icupa/vendor', cwd: process.cwd() },
  { name: 'next-web', command: 'npm run build --workspace icupa-web', cwd: process.cwd() },
];

for (const target of buildTargets) {
  try {
    console.log(`\n[Preflight] Building ${target.name} ...`);
    run(target.command, { cwd: target.cwd });
  } catch (error) {
    console.error(`\n[Preflight] Build failed for ${target.name}. Fix the errors above and re-run the script.`);
    process.exit(1);
  }
}

console.log('\nPreflight PASS: all builds completed successfully.');
