#!/usr/bin/env node

/**
 * Security Lint for MCP Tools
 * 
 * Validates MCP tool manifests for security issues:
 * - Blocks DELETE statements unless allowDangerous is set
 * - Blocks DROP statements
 * - Blocks TRUNCATE statements
 * - Warns on dynamic SQL patterns
 * - Ensures parameterized queries
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const MCP_DIR = path.join(REPO_ROOT, 'mcp');

const DANGEROUS_PATTERNS = [
  { pattern: /\bDELETE\s+FROM\b/i, message: 'DELETE statements are not allowed unless allowDangerous is set' },
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|ROLE|FUNCTION|INDEX)\b/i, message: 'DROP statements are not allowed' },
  { pattern: /\bTRUNCATE\s+TABLE\b/i, message: 'TRUNCATE statements are not allowed' },
  { pattern: /\bGRANT\s+.*\s+TO\s+service_role\b/i, message: 'Granting to service_role in app code is not allowed' },
];

const WARNING_PATTERNS = [
  { pattern: /\${\w+}/g, message: 'Template variables detected - ensure proper escaping' },
  { pattern: /\+\s*['"`]/g, message: 'String concatenation detected - use parameterized queries' },
];

let hasErrors = false;
let hasWarnings = false;

function checkToolManifest(filePath) {
  console.log(`\n📋 Checking: ${path.relative(REPO_ROOT, filePath)}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const manifest = JSON.parse(content);
    
    if (!manifest.tools || !Array.isArray(manifest.tools)) {
      console.error('  ❌ Invalid manifest: missing tools array');
      hasErrors = true;
      return;
    }
    
    for (const tool of manifest.tools) {
      console.log(`  🔧 Tool: ${tool.name}`);
      
      // Check for dangerous patterns
      for (const { pattern, message } of DANGEROUS_PATTERNS) {
        if (pattern.test(tool.sql)) {
          if (tool.allowDangerous === true) {
            console.log(`  ⚠️  ${message} (allowed by allowDangerous flag)`);
            hasWarnings = true;
          } else {
            console.error(`  ❌ ${message}`);
            hasErrors = true;
          }
        }
      }
      
      // Check for warning patterns
      for (const { pattern, message } of WARNING_PATTERNS) {
        if (pattern.test(tool.sql)) {
          console.log(`  ⚠️  ${message}`);
          hasWarnings = true;
        }
      }
      
      // Ensure parameterized queries
      if (tool.parameters && tool.parameters.length > 0) {
        const paramNames = tool.parameters.map(p => p.name);
        const sqlParams = (tool.sql.match(/:\w+/g) || []).map(p => p.slice(1));
        
        // Check if all declared params are used
        for (const paramName of paramNames) {
          if (!sqlParams.includes(paramName)) {
            console.log(`  ⚠️  Parameter '${paramName}' is declared but not used in SQL`);
            hasWarnings = true;
          }
        }
        
        // Check if all SQL params are declared
        for (const sqlParam of sqlParams) {
          if (!paramNames.includes(sqlParam)) {
            console.error(`  ❌ SQL parameter ':${sqlParam}' is not declared in parameters`);
            hasErrors = true;
          }
        }
      } else if (tool.sql.includes(':')) {
        console.error(`  ❌ SQL uses parameters but no parameters are declared`);
        hasErrors = true;
      }
    }
    
    console.log(`  ✅ Checked ${manifest.tools.length} tools`);
  } catch (err) {
    console.error(`  ❌ Error reading manifest: ${err.message}`);
    hasErrors = true;
  }
}

function main() {
  console.log('🔒 MCP Tools Security Lint\n');
  console.log(`Repository: ${REPO_ROOT}`);
  console.log(`MCP Directory: ${MCP_DIR}\n`);
  
  if (!fs.existsSync(MCP_DIR)) {
    console.error('❌ MCP directory not found');
    process.exit(1);
  }
  
  // Find all .tools.json files
  const toolFiles = fs.readdirSync(MCP_DIR)
    .filter(file => file.endsWith('.tools.json'))
    .map(file => path.join(MCP_DIR, file));
  
  if (toolFiles.length === 0) {
    console.log('⚠️  No tool manifest files found');
    process.exit(0);
  }
  
  console.log(`Found ${toolFiles.length} tool manifest(s)\n`);
  
  for (const toolFile of toolFiles) {
    checkToolManifest(toolFile);
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (hasErrors) {
    console.error('\n❌ Security lint failed with errors');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Security lint passed with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ Security lint passed');
    process.exit(0);
  }
}

main();
