#!/usr/bin/env node

// Simple validation that the routes are properly integrated
// This doesn't start the server, just validates structure

const { PERSONAS } = await import('../dist/ai/realtime/personas.js');
const { buildToolsSpec } = await import('../dist/ai/realtime/realtimeClient.js');

console.log('✓ Validating OpenAI Realtime Integration...\n');

// Validate personas
console.log('Personas:');
Object.keys(PERSONAS).forEach(key => {
  const persona = PERSONAS[key];
  console.log(`  ✓ ${key}: ${persona.tools.length} tools`);
});

// Validate tool spec builder
const waiterTools = buildToolsSpec(PERSONAS.waiter.tools);
console.log(`\n✓ Tool spec builder works: ${waiterTools.length} tools converted`);

// Validate expected tools
const expectedWaiterTools = ['lookup_menu', 'recommend_pairing'];
const expectedCfoTools = ['fetch_financials', 'check_tax_rule'];

const waiterToolNames = PERSONAS.waiter.tools.map(t => t.name);
const cfoToolNames = PERSONAS.cfo.tools.map(t => t.name);

expectedWaiterTools.forEach(name => {
  if (waiterToolNames.includes(name)) {
    console.log(`  ✓ Waiter tool: ${name}`);
  } else {
    console.error(`  ✗ Missing waiter tool: ${name}`);
    process.exit(1);
  }
});

expectedCfoTools.forEach(name => {
  if (cfoToolNames.includes(name)) {
    console.log(`  ✓ CFO tool: ${name}`);
  } else {
    console.error(`  ✗ Missing CFO tool: ${name}`);
    process.exit(1);
  }
});

console.log('\n✓ All validations passed!');
console.log('\nTo test the service:');
console.log('  1. Set OPENAI_API_KEY in .env');
console.log('  2. Run: pnpm dev');
console.log('  3. Test: pnpm ai:health');
console.log('  4. Test: pnpm ai:demo');
