import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');
const entries = readdirSync(migrationsDir).filter(
  (file) => file.endsWith('.sql') && !file.endsWith('.down.sql'),
);

if (entries.length === 0) {
  console.error('No migration files found in supabase/migrations.');
  process.exit(1);
}

const invalidNames = entries.filter((file) => {
  const match = file.match(/^(\d{14}|00000000000000)_[a-z0-9_]+\.sql$/i);
  return !match;
});

if (invalidNames.length) {
  console.error('Invalid migration filename(s):');
  invalidNames.forEach((name) => console.error(`  - ${name}`));
  process.exit(1);
}

const sorted = [...entries].sort();
const outOfOrder = entries.filter((file, index) => file !== sorted[index]);

const seenTimestamps = new Map();
const duplicateTimestamps = [];
for (const file of entries) {
  const [timestamp] = file.split('_');
  if (!timestamp) continue;
  if (seenTimestamps.has(timestamp)) {
    duplicateTimestamps.push([file, seenTimestamps.get(timestamp)]);
  } else {
    seenTimestamps.set(timestamp, file);
  }
}

if (outOfOrder.length) {
  console.error('Migrations must be sorted lexicographically by timestamp. Reorder the following files:');
  outOfOrder.forEach((name) => console.error(`  - ${name}`));
  process.exit(1);
}

if (duplicateTimestamps.length) {
  console.error('Migrations share the same timestamp. Ensure each filename has a unique prefix:');
  for (const [current, previous] of duplicateTimestamps) {
    console.error(`  - ${current} conflicts with ${previous}`);
  }
  process.exit(1);
}

const missingDown = entries.filter((file) => {
  const downPath = path.join(migrationsDir, file.replace(/\.sql$/, '.down.sql'));
  return !existsSync(downPath);
});

if (missingDown.length) {
  console.error('Missing rollback scripts for migrations:');
  missingDown.forEach((name) => console.error(`  - ${name}`));
  process.exit(1);
}

const emptyScripts = [];

for (const file of entries) {
  const fullPath = path.join(migrationsDir, file);
  const stats = statSync(fullPath);
  if (!stats.size) {
    console.error(`Migration ${file} is empty.`);
    process.exit(1);
  }

  const downPath = fullPath.replace(/\.sql$/, '.down.sql');
  if (existsSync(downPath)) {
    const downStats = statSync(downPath);
    if (!downStats.size) {
      emptyScripts.push(path.basename(downPath));
    }
  }
}

if (emptyScripts.length) {
  console.error('Rollback scripts must not be empty:');
  emptyScripts.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

console.log(`✅ ${entries.length} migrations validated. All files ordered and rollback scripts present.`);
