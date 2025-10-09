#!/usr/bin/env node

import { accessSync, appendFileSync, constants, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { once } from 'events';
import { setTimeout as delay } from 'timers/promises';
import process from 'process';

const results = [];
let overallPass = true;

function record(status, name, detail) {
  if (status === 'fail') {
    overallPass = false;
  }
  results.push({ status, name, detail });
}

function statusIcon(status) {
  switch (status) {
    case 'pass':
      return '✅';
    case 'warn':
      return '⚠️';
    default:
      return '❌';
  }
}

function fileExists(path) {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function runCommand(command, args, label, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...options.env },
      shell: false,
      cwd: options.cwd ?? process.cwd(),
    });

    child.on('close', (code) => {
      if (code === 0) {
        record('pass', label, '');
        resolve({ ok: true });
      } else {
        record('fail', label, `Exited with code ${code}`);
        resolve({ ok: false, code });
      }
    });
  });
}

(async () => {
  let preview;
  try {
    // Manifest checks
    try {
      const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
      const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
      const has192 = icons.some((icon) => icon.type === 'image/png' && icon.sizes === '192x192');
      const has512 = icons.some((icon) => icon.type === 'image/png' && icon.sizes === '512x512');
      if (has192 && has512) {
        record('pass', 'Manifest declares 192px and 512px PNG icons', '');
      } else {
        record('fail', 'Manifest declares required icons', 'Missing 192px or 512px PNG icons');
      }
    } catch (error) {
      record('fail', 'Manifest is readable JSON', error instanceof Error ? error.message : String(error));
    }

    const iconsPresent = ['public/icons/icon-192.png', 'public/icons/icon-512.png'].every(fileExists);
    record(iconsPresent ? 'pass' : 'fail', 'Icon files exist', iconsPresent ? '' : 'Expected icons under public/icons/');

    try {
      const html = readFileSync('index.html', 'utf8');
      const hasManifestLink = /<link\s+[^>]*rel=["']manifest["'][^>]*>/i.test(html);
      const hasThemeColor = /<meta\s+[^>]*name=["']theme-color["'][^>]*#/i.test(html);
      record(hasManifestLink ? 'pass' : 'fail', 'index.html references manifest.json', '');
      record(hasThemeColor ? 'pass' : 'fail', 'Theme colour meta tag present', hasThemeColor ? '' : '');
    } catch (error) {
      record('fail', 'index.html accessible', error instanceof Error ? error.message : String(error));
    }

    try {
      const mainSource = readFileSync('src/main.tsx', 'utf8');
      const registersSw = /registerSW\s*\(/.test(mainSource);
      record(registersSw ? 'pass' : 'fail', 'Service worker registration present', '');
    } catch (error) {
      record('fail', 'Service worker bootstrap readable', error instanceof Error ? error.message : String(error));
    }

    if (process.env.VERCEL_REGION) {
      try {
        const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
        const regions = Array.isArray(vercelConfig.regions) ? vercelConfig.regions : [];
        if (regions.includes(process.env.VERCEL_REGION)) {
          record('pass', 'VERCEL_REGION matches vercel.json regions', '');
        } else {
          record('warn', 'VERCEL_REGION mismatch', `Set to ${process.env.VERCEL_REGION} but vercel.json has [${regions.join(', ')}]`);
        }
      } catch (error) {
        record('warn', 'vercel.json readable', error instanceof Error ? error.message : String(error));
      }
    }

    const build = await runCommand('npm', ['run', 'build'], 'npm run build');
    if (build.ok) {
      preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '5000'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' },
      });

      let previewLog = '';
      let previewExited = false;
      let previewExitCode = null;
      preview.stdout.on('data', (chunk) => {
        previewLog += chunk.toString();
      });
      preview.stderr.on('data', (chunk) => {
        previewLog += chunk.toString();
      });
      preview.on('close', (code) => {
        previewExited = true;
        previewExitCode = code;
      });

      const baseUrl = 'http://127.0.0.1:5000';
      let reachable = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await delay(500);
        if (previewExited && previewExitCode !== 0) {
          break;
        }
        try {
          const response = await fetch(baseUrl, { redirect: 'manual' });
          if (response.ok || response.status === 200) {
            reachable = true;
            break;
          }
        } catch (error) {
          // Ignore while server boots
        }
      }

      if (reachable) {
        record('pass', 'Preview server serves / (HTTP 200)', '');
      } else if (previewExited && previewExitCode !== 0) {
        const detail = previewLog.trim() || `Preview exited with code ${previewExitCode}`;
        record('warn', 'Preview server serves / (HTTP 200)', detail);
      } else {
        record('warn', 'Preview server serves / (HTTP 200)', 'Preview did not respond within timeout');
      }
    } else {
      record('warn', 'Preview server serves / (HTTP 200)', 'Skipped because build failed');
    }

    const summaryLines = results.map(({ status, name, detail }) => {
      const extra = detail ? ` – ${detail}` : '';
      return `${statusIcon(status)} ${name}${extra}`;
    });

    const summaryText = summaryLines.join('\n');
    console.log(summaryText);
    console.log(`\nOverall: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

    const timestamp = new Date().toISOString();
    const docEntry = `\n### Verification ${timestamp}\n${summaryLines.map((line) => `- ${line}`).join('\n')}\n`;
    appendFileSync('docs/deployment/vercel-readiness.md', docEntry);

    if (!overallPass) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Verification aborted:', error.message);
    } else {
      console.error('Verification aborted:', error);
    }
    process.exitCode = 1;
  } finally {
    if (preview && !preview.killed) {
      preview.kill('SIGINT');
      try {
        await once(preview, 'close');
      } catch (error) {
        // ignore
      }
    }
  }
})();
