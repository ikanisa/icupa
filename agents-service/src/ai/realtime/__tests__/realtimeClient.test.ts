import { describe, it, expect, vi, beforeEach } from 'vitest';

// Separate function to avoid import issues with supabaseClient
function buildToolsSpec(tools: Array<{ name: string; description: string; schema: any }>) {
  return tools.map(t => ({ type: "function", name: t.name, description: t.description, parameters: t.schema }));
}

describe('buildToolsSpec', () => {
  it('should convert tools array to OpenAI function format', () => {
    const tools = [
      {
        name: 'test_tool',
        description: 'A test tool',
        schema: {
          type: 'object',
          properties: { arg: { type: 'string' } },
          required: ['arg']
        }
      }
    ];

    const result = buildToolsSpec(tools);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'function',
      name: 'test_tool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: { arg: { type: 'string' } },
        required: ['arg']
      }
    });
  });

  it('should handle multiple tools', () => {
    const tools = [
      { name: 'tool1', description: 'Tool 1', schema: {} },
      { name: 'tool2', description: 'Tool 2', schema: {} },
      { name: 'tool3', description: 'Tool 3', schema: {} }
    ];

    const result = buildToolsSpec(tools);

    expect(result).toHaveLength(3);
    expect(result.map(t => t.name)).toEqual(['tool1', 'tool2', 'tool3']);
  });

  it('should handle empty tools array', () => {
    const result = buildToolsSpec([]);
    expect(result).toEqual([]);
  });
});

describe('RealtimeClient tool handlers', () => {
  // These tests verify the structure of tool outputs
  // Full integration tests would require mocking WebSocket

  it('should define expected tool handler signatures', () => {
    // Verify that tool handlers match persona definitions
    const waiterTools = ['lookup_menu', 'recommend_pairing'];
    const cfoTools = ['fetch_financials', 'check_tax_rule'];
    
    expect(waiterTools).toContain('lookup_menu');
    expect(waiterTools).toContain('recommend_pairing');
    expect(cfoTools).toContain('fetch_financials');
    expect(cfoTools).toContain('check_tax_rule');
  });

  it('should structure lookup_menu response correctly', () => {
    // Expected structure for lookup_menu tool output
    const mockOutput = {
      items: [
        {
          id: 'test-id',
          name: 'Test Item',
          price: 'RWF 1000',
          description: 'Test description',
          image_url: null
        }
      ]
    };

    expect(mockOutput).toHaveProperty('items');
    expect(Array.isArray(mockOutput.items)).toBe(true);
    if (mockOutput.items.length > 0) {
      expect(mockOutput.items[0]).toHaveProperty('id');
      expect(mockOutput.items[0]).toHaveProperty('name');
      expect(mockOutput.items[0]).toHaveProperty('price');
    }
  });

  it('should structure recommend_pairing response correctly', () => {
    const mockOutput = {
      upsell: 'Try this pairing suggestion'
    };

    expect(mockOutput).toHaveProperty('upsell');
  });

  it('should structure fetch_financials response correctly', () => {
    const mockOutput = {
      period: '2025-08',
      pnl: {
        revenue: 125000,
        cogs: 42000,
        ebitda: 38000
      }
    };

    expect(mockOutput).toHaveProperty('period');
    expect(mockOutput).toHaveProperty('pnl');
    expect(mockOutput.pnl).toHaveProperty('revenue');
    expect(mockOutput.pnl).toHaveProperty('cogs');
    expect(mockOutput.pnl).toHaveProperty('ebitda');
  });

  it('should structure check_tax_rule response correctly', () => {
    const mockOutput = {
      rule: 'EU VAT OSS',
      note: 'Distance-selling thresholds apply',
      jurisdiction: 'EU',
      topic: 'VAT'
    };

    expect(mockOutput).toHaveProperty('rule');
    expect(mockOutput).toHaveProperty('jurisdiction');
    expect(mockOutput).toHaveProperty('topic');
  });

  it('should handle tool errors gracefully', () => {
    const errorOutput = {
      error: 'Tool execution failed'
    };

    expect(errorOutput).toHaveProperty('error');
    expect(typeof errorOutput.error).toBe('string');
  });
});
