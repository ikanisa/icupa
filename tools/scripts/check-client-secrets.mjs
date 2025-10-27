#!/usr/bin/env node

/**
 * check-client-secrets.mjs
 * 
 * Scans client-facing directories for server-only environment variable names
 * to prevent accidental exposure of sensitive keys in client code.
 * 
 * Usage: node tools/scripts/check-client-secrets.mjs
 */

import { readFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..", "..");

// Server-only environment variable names that should never appear in client code
const SERVER_ONLY_ENV_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL", // When not prefixed with NEXT_PUBLIC_ or VITE_
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_API_KEY",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "PRIVATE_KEY",
  "SECRET_KEY",
  "API_SECRET",
];

// Client-facing directories to scan
const CLIENT_DIRS = [
  "apps/ecotrips/app",
  "src",
  "apps/admin",
  "public",
];

// File extensions to scan
const SCANNABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

// Patterns to ignore (node_modules, build outputs, etc.)
const IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".git",
  ".env",
  ".env.local",
  ".env.example",
  ".env.local.example",
];

// Server-side paths within client directories (these are OK to have server secrets)
const SERVER_SIDE_PATHS = [
  "/app/api/",     // Next.js API routes
  "/pages/api/",   // Next.js API routes (pages router)
  "/api/",         // Generic API routes
  "/server/",      // Server-only code
  "/tests/",       // Test files
  "/test/",        // Test files
  ".spec.",        // Test specs
  ".test.",        // Test files
  "/src/env.",     // Environment configuration files
  "/config/env.",  // Environment configuration files
];

async function* walkDir(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip ignored patterns
      if (IGNORE_PATTERNS.some((pattern) => entry.name.includes(pattern))) {
        continue;
      }

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        yield* walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf("."));
        if (SCANNABLE_EXTENSIONS.includes(ext)) {
          yield fullPath;
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
    if (error.code !== "ENOENT" && error.code !== "EACCES") {
      throw error;
    }
  }
}

async function scanFile(filePath) {
  try {
    // Skip server-side files - they're allowed to use server-only env vars
    const normalizedPath = filePath.replace(/\\/g, "/");
    if (SERVER_SIDE_PATHS.some((pattern) => normalizedPath.includes(pattern))) {
      return [];
    }

    const content = await readFile(filePath, "utf8");
    const findings = [];

    // Look for environment variable references
    for (const envVar of SERVER_ONLY_ENV_VARS) {
      // Pattern 1: process.env.VAR_NAME or import.meta.env.VAR_NAME
      const pattern1 = new RegExp(
        `(process\\.env|import\\.meta\\.env)\\.${envVar}`,
        "g"
      );
      // Pattern 2: process.env["VAR_NAME"] or import.meta.env["VAR_NAME"]
      const pattern2 = new RegExp(
        `(process\\.env|import\\.meta\\.env)\\["${envVar}"\\]`,
        "g"
      );
      // Pattern 3: String references in environment variable names
      const pattern3 = new RegExp(`["'\`]${envVar}["'\`]`, "g");

      let match;
      const patterns = [pattern1, pattern2, pattern3];

      for (const pattern of patterns) {
        while ((match = pattern.exec(content)) !== null) {
          // Get line number
          const lineNumber =
            content.substring(0, match.index).split("\n").length;

          // Get the line content
          const lines = content.split("\n");
          const lineContent = lines[lineNumber - 1]?.trim() || "";

          // Skip if it's a comment
          if (lineContent.startsWith("//") || lineContent.startsWith("*")) {
            continue;
          }

          // Skip if it's in a comment block
          const beforeMatch = content.substring(0, match.index);
          const lastCommentStart = beforeMatch.lastIndexOf("/*");
          const lastCommentEnd = beforeMatch.lastIndexOf("*/");
          if (lastCommentStart > lastCommentEnd) {
            continue;
          }

          findings.push({
            file: relative(rootDir, filePath),
            line: lineNumber,
            envVar,
            context: lineContent.substring(0, 100),
          });
        }
      }
    }

    return findings;
  } catch (error) {
    // Skip files we can't read
    return [];
  }
}

async function main() {
  console.log("🔍 Scanning client-facing directories for server-only secrets...\n");

  const allFindings = [];

  for (const clientDir of CLIENT_DIRS) {
    const fullPath = join(rootDir, clientDir);
    
    try {
      await stat(fullPath);
    } catch {
      // Skip directories that don't exist
      continue;
    }

    console.log(`Scanning ${clientDir}...`);

    for await (const file of walkDir(fullPath)) {
      const findings = await scanFile(file);
      allFindings.push(...findings);
    }
  }

  if (allFindings.length === 0) {
    console.log("\n✅ No server-only secrets found in client code.");
    process.exit(0);
  }

  console.log("\n❌ Found server-only secrets in client code:\n");

  const groupedByFile = {};
  for (const finding of allFindings) {
    if (!groupedByFile[finding.file]) {
      groupedByFile[finding.file] = [];
    }
    groupedByFile[finding.file].push(finding);
  }

  for (const [file, findings] of Object.entries(groupedByFile)) {
    console.log(`\n📄 ${file}`);
    for (const finding of findings) {
      console.log(
        `   Line ${finding.line}: ${finding.envVar}`
      );
      console.log(`   Context: ${finding.context}`);
    }
  }

  console.log(
    "\n⚠️  Server-only environment variables should never be exposed in client code."
  );
  console.log(
    "   Move these to server-side API routes or use public equivalents (NEXT_PUBLIC_*, VITE_*)."
  );

  process.exit(1);
}

main().catch((error) => {
  console.error("Error running secret scanner:", error);
  process.exit(1);
});
