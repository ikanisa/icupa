#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvFile } from 'dotenv';

const cwd = process.cwd();

const parseArgs = (argv) => {
  const envFiles = [];
  const passthrough = [];
  let shouldSkipBuild = false;
  let targetEnvironment = 'preview';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--skip-build') {
      shouldSkipBuild = true;
      continue;
    }

    if (arg === '--prod' || arg === '--production') {
      targetEnvironment = 'production';
      continue;
    }

    if (arg === '--preview') {
      targetEnvironment = 'preview';
      continue;
    }

    if (arg === '--env-file') {
      const value = argv[index + 1];
      if (!value) {
        console.error('[deploy] --env-file requires a following path argument.');
        process.exit(1);
      }

      envFiles.push({ value, source: '--env-file' });
      index += 1;
      continue;
    }

    if (arg.startsWith('--env-file=')) {
      envFiles.push({ value: arg.split('=')[1], source: '--env-file' });
      continue;
    }

    if (arg === '--') {
      passthrough.push(...argv.slice(index + 1));
      break;
    }

    passthrough.push(arg);
  }

  return {
    envFiles,
    passthrough,
    shouldSkipBuild,
    targetEnvironment,
  };
};

const loadEnvFiles = (explicitFiles) => {
  const resolved = new Map();
  const register = (value, source, required = false) => {
    if (!value) {
      return;
    }

    const parts = Array.isArray(value) ? value : `${value}`.split(path.delimiter);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const filePath = path.resolve(cwd, trimmed);
      const entry = resolved.get(filePath) ?? { path: filePath, required: false, sources: new Set() };
      entry.required = entry.required || required;
      entry.sources.add(source);
      resolved.set(filePath, entry);
    }
  };

  if (explicitFiles.length > 0) {
    for (const file of explicitFiles) {
      register(file.value, file.source, true);
    }
  } else {
    register(process.env.VERCEL_DEPLOY_ENV_FILE, 'VERCEL_DEPLOY_ENV_FILE');
    register(process.env.VERCEL_DEPLOY_ENV_FILES, 'VERCEL_DEPLOY_ENV_FILES');
    register(['.env.deploy', '.env.preview', '.env.production.local', '.env.local'], 'default search');
  }

  const loaded = [];

  for (const entry of resolved.values()) {
    const { path: candidatePath, required, sources } = entry;

    if (!fs.existsSync(candidatePath)) {
      if (required) {
        console.warn(
          `[deploy] Skipped missing env file from ${Array.from(sources).join(', ')}: ${candidatePath}`
        );
      }
      continue;
    }

    const relativePath = path.relative(cwd, candidatePath);
    console.log(`[deploy] Loading environment from ${relativePath}`);
    loadEnvFile({ path: candidatePath, override: false });
    loaded.push(relativePath);
  }

  if (loaded.length === 0) {
    console.log('[deploy] No env files loaded; using process environment.');
  }
};

const envRequirements = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase project URL (public)'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anon key (public)'],
  ['VITE_SUPABASE_URL', 'Supabase project URL for Vite build'],
  ['VITE_SUPABASE_ANON_KEY', 'Supabase anon key for Vite build'],
  ['NEXT_PUBLIC_AGENTS_URL', 'Agents-service base URL exposed to Next.js apps'],
  ['VITE_AGENTS_URL', 'Agents-service base URL exposed to Vite apps'],
  ['VERCEL_TOKEN', 'Vercel access token (create at https://vercel.com/account/tokens)'],
];

const optionalEnv = [
  ['VERCEL_ORG_ID', 'Vercel org/team ID (auto-populated by `vercel pull`)'],
  ['VERCEL_PROJECT_ID', 'Vercel project ID (set when deploying a single project)'],
];

const validateRequiredEnv = () => {
  const missing = envRequirements.filter(([key]) => !process.env[key] || `${process.env[key]}`.trim().length === 0);

  if (missing.length > 0) {
    console.error('\n[deploy] Missing required environment variables:');
    for (const [key, description] of missing) {
      console.error(`  - ${key}: ${description}`);
    }
    console.error('\nPopulate the variables above (see audit/env-matrix.csv) and re-run `npm run deploy`.');
    process.exit(1);
  }
};

const logOptionalHints = () => {
  const missingOptional = optionalEnv.filter(([key]) => !process.env[key] || `${process.env[key]}`.trim().length === 0);
  if (missingOptional.length > 0) {
    console.warn('\n[deploy] Optional environment hints:');
    for (const [key, description] of missingOptional) {
      console.warn(`  - ${key}: ${description}`);
    }
    console.warn('The Vercel CLI will attempt to infer these values from your linked project.');
  }
};

const runStep = (label, command, args, options = {}) => {
  console.log(`\n[deploy] ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    console.error(`\n[deploy] Step failed: ${label}`);
    process.exit(result.status ?? 1);
  }
};

const extraArgs = process.argv.slice(2);
const { envFiles, passthrough, shouldSkipBuild, targetEnvironment } = parseArgs(extraArgs);

loadEnvFiles(envFiles);

validateRequiredEnv();

logOptionalHints();

const vercelArgs = ['--yes', '--token', process.env.VERCEL_TOKEN];
if (process.env.VERCEL_ORG_ID) {
  vercelArgs.push('--scope', process.env.VERCEL_ORG_ID);
}
if (process.env.VERCEL_PROJECT_ID) {
  vercelArgs.push('--project', process.env.VERCEL_PROJECT_ID);
}

runStep('Syncing project settings (vercel pull)', 'npx', ['--yes', 'vercel', 'pull', '--environment', targetEnvironment, ...vercelArgs]);

if (!shouldSkipBuild) {
  runStep(
    'Building with Vercel (vercel build)',
    'npx',
    ['--yes', 'vercel', 'build', '--environment', targetEnvironment, ...vercelArgs]
  );
} else {
  console.log('[deploy] Skipping build step as requested (using existing .vercel/output).');
}

runStep(
  `Deploying ${targetEnvironment} build (vercel deploy)`,
  'npx',
  ['--yes', 'vercel', 'deploy', '--prebuilt', '--environment', targetEnvironment, ...vercelArgs, ...passthrough]
);

console.log(`\n[deploy] Success! Preview available via Vercel dashboard for the ${targetEnvironment} environment.`);
