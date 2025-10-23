import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const dependencyUsage = new Map();
const engineMatrix = new Map();
const runtimeFocus = new Set(['next', 'react', 'react-dom', 'typescript', '@supabase/supabase-js']);
const runtimeMatrix = new Map();

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, '..');
const pkgList = execSync("git ls-files -- '*package.json'", { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const header = ['# Dependency Inventory', ''];
const sections = [];

function sanitizeVersion(version) {
  if (!version) return null;
  const forbiddenPrefixes = ['workspace:', 'file:', 'link:', 'git+', 'github:', 'http:', 'https:'];
  if (forbiddenPrefixes.some((prefix) => version.startsWith(prefix))) {
    return null;
  }
  let sanitized = version.replace(/^npm:/, '');
  sanitized = sanitized.replace(/^[~^]/, '');
  if (!sanitized) return null;
  return sanitized;
}

function recordDependency(dep, version, pkgName, pkgPath) {
  if (!dependencyUsage.has(dep)) {
    dependencyUsage.set(dep, []);
  }
  dependencyUsage.get(dep).push({
    packageName: pkgName,
    packagePath: pkgPath,
    version,
    sanitized: sanitizeVersion(version),
  });
  if (runtimeFocus.has(dep)) {
    if (!runtimeMatrix.has(dep)) {
      runtimeMatrix.set(dep, []);
    }
    runtimeMatrix.get(dep).push({
      packageName: pkgName,
      version,
    });
  }
}

function recordEngine(pkgName, engine) {
  if (!engine) return;
  if (!engineMatrix.has(engine)) {
    engineMatrix.set(engine, new Set());
  }
  engineMatrix.get(engine).add(pkgName);
}

for (const pkgPath of pkgList) {
  const fullPath = join(repoRoot, pkgPath);
  const pkg = JSON.parse(readFileSync(fullPath, 'utf8'));
  const name = pkg.name ?? dirname(pkgPath);
  const meta = [`## ${name}`, `- package.json: ${pkgPath}`];
  if (pkg.version) meta.push(`- version: ${pkg.version}`);
  if (pkg.engines?.node) {
    meta.push(`- node engine: ${pkg.engines.node}`);
    recordEngine(name, pkg.engines.node);
  }

  const groups = [
    ['dependencies', 'Dependencies'],
    ['devDependencies', 'Dev Dependencies'],
    ['peerDependencies', 'Peer Dependencies'],
    ['optionalDependencies', 'Optional Dependencies'],
  ];

  for (const [key, label] of groups) {
    const entries = Object.entries(pkg[key] ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const pinned = entries.filter(([, version]) => !/^([~^]|workspace:|file:|link:|git\+|https?:|\*)/.test(version));
    meta.push(`- ${label}: ${entries.length}`);
    if (pinned.length) {
      meta.push(`  - Pinned (${pinned.length}): ${pinned.map(([dep, version]) => `${dep}@${version}`).join(', ')}`);
    }
  }

  sections.push(meta.join('\n'));

  for (const [key, label] of groups) {
    const entries = Object.entries(pkg[key] ?? {}).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) continue;
    const lines = [`### ${label}`];
    for (const [dep, version] of entries) {
      lines.push(`- ${dep}: ${version}`);
      recordDependency(dep, version, name, pkgPath);
    }
    sections.push(lines.join('\n'));
  }
}

const warnings = [];

for (const [dep, usages] of dependencyUsage) {
  const comparable = new Map();
  for (const usage of usages) {
    if (!usage.sanitized) continue;
    if (!comparable.has(usage.sanitized)) {
      comparable.set(usage.sanitized, []);
    }
    comparable.get(usage.sanitized).push(`${usage.packageName} (${usage.version})`);
  }
  if (comparable.size > 1) {
    const detail = [...comparable.entries()]
      .map(([version, packages]) => `${version}: ${packages.join(', ')}`)
      .join(' | ');
    warnings.push(`- ⚠️ ${dep} version mismatch → ${detail}`);
  }
}

const engineEntries = [...engineMatrix.entries()];
if (engineEntries.length > 1) {
  const detail = engineEntries
    .map(([engine, packages]) => `${engine}: ${[...packages].join(', ')}`)
    .join(' | ');
  warnings.push(`- ⚠️ Node engine requirements diverge across workspaces → ${detail}`);
}

const runtimeNotes = [];
for (const [runtime, records] of runtimeMatrix) {
  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.version)) {
      grouped.set(record.version, []);
    }
    grouped.get(record.version).push(record.packageName);
  }
  const detail = [...grouped.entries()]
    .map(([version, packages]) => `${version}: ${packages.join(', ')}`)
    .join(' | ');
  runtimeNotes.push(`- ${runtime}: ${detail}`);
}

header.push('## Warnings');
if (warnings.length) {
  header.push(...warnings);
} else {
  header.push('- No cross-workspace dependency conflicts detected.');
}

header.push('', '## Runtime Alignment Focus');
if (runtimeNotes.length) {
  header.push(...runtimeNotes);
} else {
  header.push('- Runtime focus packages not detected in workspace manifests.');
}

writeFileSync(join(repoRoot, '.ci/DEPENDENCY_INVENTORY.md'), header.concat(sections).join('\n\n') + '\n');
