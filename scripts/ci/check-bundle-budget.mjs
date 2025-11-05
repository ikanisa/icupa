#!/usr/bin/env node
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve("dist/assets");
const MAX_CHUNK_KB = 320;
const MAX_TOTAL_KB = 2500;

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath);
      }
      return fullPath;
    }),
  );
  return files.flat();
}

async function main() {
  try {
    const files = await listFiles(DIST_DIR);
    const assetFiles = files.filter((file) => /\.(js|css)$/i.test(file));

    if (assetFiles.length === 0) {
      console.warn(`[bundle-budget] No built assets found under ${DIST_DIR}. Did you run \`pnpm build\`?`);
      process.exit(0);
    }

    let totalBytes = 0;
    const oversized = [];

    for (const file of assetFiles) {
      const fileStat = await stat(file);
      totalBytes += fileStat.size;
      const kb = fileStat.size / 1024;
      if (kb > MAX_CHUNK_KB) {
        oversized.push({ file, kb: Number(kb.toFixed(2)) });
      }
    }

    const totalKb = totalBytes / 1024;

    if (totalKb > MAX_TOTAL_KB) {
      console.error(
        `\u274c Bundle budget exceeded: total JS/CSS is ${totalKb.toFixed(2)}kb (limit ${MAX_TOTAL_KB}kb)`,
      );
      process.exit(1);
    }

    if (oversized.length > 0) {
      console.error(`\u274c Bundle budget exceeded for ${oversized.length} chunk(s):`);
      oversized.forEach(({ file, kb }) => console.error(`  - ${file}: ${kb}kb (limit ${MAX_CHUNK_KB}kb)`));
      process.exit(1);
    }

    console.info(`\u2705 Bundle budgets within threshold (total ${totalKb.toFixed(2)}kb).`);
  } catch (error) {
    console.error("Failed to evaluate bundle budgets:", error);
    process.exit(1);
  }
}

await main();
