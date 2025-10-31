/**
 * Tests for agent types
 * 
 * These tests verify the type definitions and error classes for the OpenAI Agents SDK integration.
 */

import { describe, it, expect } from 'vitest';
import {
  AgentError,
  ToolError,
  BudgetExceededError,
  AgentDisabledError,
  type BaseAgentContext,
  type BookingContext,
  type MenuContext,
  type AgentResult,
  type BookingResult,
  type ToolContext,
  type ToolResult,
  type AgentConfig,
  type AgentRequest,
  type AgentResponse,
} from './agents';

describe('Error Classes', () => {
  describe('AgentError', () => {
    it('should create an error with code and details', () => {
      const error = new AgentError('Test error', 'TEST_CODE', { foo: 'bar' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('AgentError');
      expect(error instanceof Error).toBe(true);
    });

    it('should work without details', () => {
      const error = new AgentError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toBeUndefined();
    });
  });

  describe('ToolError', () => {
    it('should create an error with tool name', () => {
      const error = new ToolError('Tool failed', 'my_tool', { reason: 'timeout' });
      
      expect(error.message).toBe('Tool failed');
      expect(error.toolName).toBe('my_tool');
      expect(error.details).toEqual({ reason: 'timeout' });
      expect(error.name).toBe('ToolError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('BudgetExceededError', () => {
    it('should create a budget error', () => {
      const error = new BudgetExceededError('Budget exceeded', { limit: 100 });
      
      expect(error.message).toBe('Budget exceeded');
      expect(error.code).toBe('BUDGET_EXCEEDED');
      expect(error.details).toEqual({ limit: 100 });
      expect(error.name).toBe('BudgetExceededError');
      expect(error instanceof AgentError).toBe(true);
    });
  });

  describe('AgentDisabledError', () => {
    it('should create a disabled error with agent name', () => {
      const error = new AgentDisabledError('waiter');
      
      expect(error.message).toContain('waiter');
      expect(error.message).toContain('disabled');
      expect(error.code).toBe('AGENT_DISABLED');
      expect(error.details).toEqual({ agentName: 'waiter' });
      expect(error.name).toBe('AgentDisabledError');
    });
  });
});

describe('Type Definitions', () => {
  it('should define BaseAgentContext', () => {
    const context: BaseAgentContext = {
      sessionId: 'sess-123',
      tenantId: 'tenant-456',
      userId: 'user-789',
      locationId: 'loc-abc',
      language: 'English',
      region: 'Rwanda',
    };
    
    expect(context.sessionId).toBe('sess-123');
    expect(context.tenantId).toBe('tenant-456');
  });

  it('should define BookingContext extending BaseAgentContext', () => {
    const context: BookingContext = {
      sessionId: 'sess-123',
      tenantId: 'tenant-456',
      customerEmail: 'test@example.com',
      customerName: 'John Doe',
      draftBooking: {
        date: '2025-11-15',
        time: '19:00',
        partySize: 4,
      },
    };
    
    expect(context.customerEmail).toBe('test@example.com');
    expect(context.draftBooking?.partySize).toBe(4);
  });

  it('should define MenuContext extending BaseAgentContext', () => {
    const context: MenuContext = {
      sessionId: 'sess-123',
      allergies: ['peanuts', 'shellfish'],
      ageVerified: true,
      legalDrinkingAge: 18,
      cart: [
        {
          itemId: 'item-1',
          name: 'Burger',
          quantity: 2,
          priceInCents: 1500,
        },
      ],
    };
    
    expect(context.allergies).toEqual(['peanuts', 'shellfish']);
    expect(context.cart?.length).toBe(1);
  });

  it('should define AgentResult', () => {
    const result: AgentResult<{ message: string }> = {
      sessionId: 'sess-123',
      output: { message: 'Hello' },
      costUsd: 0.05,
      metadata: {
        model: 'gpt-4o',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
        executionTimeMs: 1500,
      },
    };
    
    expect(result.sessionId).toBe('sess-123');
    expect(result.costUsd).toBe(0.05);
    expect(result.metadata?.model).toBe('gpt-4o');
  });

  it('should define BookingResult', () => {
    const result: BookingResult = {
      reply: 'Booking confirmed',
      bookings: [
        {
          bookingId: 'BK-123',
          date: '2025-11-15',
          time: '19:00',
          partySize: 4,
          status: 'confirmed',
        },
      ],
      nextSteps: ['Check in 30 minutes before arrival'],
      disclaimers: ['Booking is subject to availability'],
    };
    
    expect(result.reply).toBe('Booking confirmed');
    expect(result.bookings?.length).toBe(1);
  });

  it('should define ToolContext', () => {
    const context: ToolContext = {
      sessionId: 'sess-123',
      tenantId: 'tenant-456',
      userId: 'user-789',
      metadata: { source: 'api' },
    };
    
    expect(context.sessionId).toBe('sess-123');
    expect(context.metadata?.source).toBe('api');
  });

  it('should define ToolResult', () => {
    const result: ToolResult<{ count: number }> = {
      success: true,
      data: { count: 42 },
      metadata: { cached: true },
    };
    
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(42);
  });

  it('should define AgentConfig', () => {
    const config: AgentConfig = {
      name: 'booking',
      enabled: true,
      model: 'gpt-4o',
      maxTokens: 1000,
      temperature: 0.7,
      timeoutMs: 30000,
      budget: {
        maxCostPerSession: 1.0,
        maxCostPerDay: 100.0,
      },
    };
    
    expect(config.name).toBe('booking');
    expect(config.budget?.maxCostPerSession).toBe(1.0);
  });

  it('should define AgentRequest', () => {
    const request: AgentRequest<BaseAgentContext> = {
      message: 'Book a table',
      sessionId: 'sess-123',
      context: {
        tenantId: 'tenant-456',
        language: 'English',
      },
      stream: false,
    };
    
    expect(request.message).toBe('Book a table');
    expect(request.context.tenantId).toBe('tenant-456');
  });

  it('should define AgentResponse', () => {
    const response: AgentResponse<{ reply: string }> = {
      sessionId: 'sess-123',
      output: { reply: 'Table booked' },
      costUsd: 0.05,
      metadata: {
        model: 'gpt-4o',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
        executionTimeMs: 1500,
      },
    };
    
    expect(response.sessionId).toBe('sess-123');
    expect(response.output.reply).toBe('Table booked');
  });
});
