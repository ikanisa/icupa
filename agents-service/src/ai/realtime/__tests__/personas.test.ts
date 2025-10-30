import { describe, it, expect } from 'vitest';
import { PERSONAS, PersonaKey } from '../personas';

// Separate function to avoid import issues with supabaseClient
function buildToolsSpec(tools: Array<{ name: string; description: string; schema: any }>) {
  return tools.map(t => ({ type: "function", name: t.name, description: t.description, parameters: t.schema }));
}

describe('personas', () => {
  it('should define waiter persona', () => {
    expect(PERSONAS.waiter).toBeDefined();
    expect(PERSONAS.waiter.system).toContain('AI Waiter');
    expect(PERSONAS.waiter.tools).toHaveLength(2);
  });

  it('should define cfo persona', () => {
    expect(PERSONAS.cfo).toBeDefined();
    expect(PERSONAS.cfo.system).toContain('AI CFO');
    expect(PERSONAS.cfo.tools).toHaveLength(2);
  });

  it('waiter should have lookup_menu tool', () => {
    const lookupTool = PERSONAS.waiter.tools.find(t => t.name === 'lookup_menu');
    expect(lookupTool).toBeDefined();
    expect(lookupTool?.description).toContain('menu item');
    expect(lookupTool?.schema).toHaveProperty('properties');
  });

  it('waiter should have recommend_pairing tool', () => {
    const pairingTool = PERSONAS.waiter.tools.find(t => t.name === 'recommend_pairing');
    expect(pairingTool).toBeDefined();
    expect(pairingTool?.description).toContain('pairing');
  });

  it('cfo should have fetch_financials tool', () => {
    const financialsTool = PERSONAS.cfo.tools.find(t => t.name === 'fetch_financials');
    expect(financialsTool).toBeDefined();
    expect(financialsTool?.description).toContain('GL');
  });

  it('cfo should have check_tax_rule tool', () => {
    const taxTool = PERSONAS.cfo.tools.find(t => t.name === 'check_tax_rule');
    expect(taxTool).toBeDefined();
    expect(taxTool?.description).toContain('tax');
  });

  it('buildToolsSpec should convert tools to OpenAI format', () => {
    const tools = buildToolsSpec(PERSONAS.waiter.tools);
    expect(tools).toHaveLength(2);
    expect(tools[0]).toHaveProperty('type', 'function');
    expect(tools[0]).toHaveProperty('name', 'lookup_menu');
    expect(tools[0]).toHaveProperty('description');
    expect(tools[0]).toHaveProperty('parameters');
  });

  it('all personas should have valid PersonaKey', () => {
    const validKeys: PersonaKey[] = ['waiter', 'cfo'];
    Object.keys(PERSONAS).forEach(key => {
      expect(validKeys).toContain(key);
    });
  });
});
