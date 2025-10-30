/**
 * Shared TypeScript types for OpenAI Agents SDK integration
 * 
 * This module defines common types used across the agents, tools, and API handlers.
 * Following the pattern from the OpenAI Agents SDK integration blueprint.
 */

/**
 * Base context interface for all agents
 * This provides common fields that all agents need
 */
export interface BaseAgentContext {
  /** Unique session identifier for tracking conversation */
  sessionId?: string;
  
  /** Tenant/organization identifier for multi-tenancy */
  tenantId?: string;
  
  /** User identifier */
  userId?: string;
  
  /** Location/venue identifier */
  locationId?: string;
  
  /** Preferred language for responses */
  language?: string;
  
  /** Geographic region */
  region?: string;
}

/**
 * Booking-specific context
 * Extends base context with booking-related information
 */
export interface BookingContext extends BaseAgentContext {
  /** Customer information if available */
  customerEmail?: string;
  customerName?: string;
  
  /** Current booking draft if in progress */
  draftBooking?: {
    date?: string;
    time?: string;
    partySize?: number;
    notes?: string;
  };
}

/**
 * Menu/ordering context
 * For agents that handle menu browsing and ordering
 */
export interface MenuContext extends BaseAgentContext {
  /** Customer dietary restrictions */
  allergies?: string[];
  
  /** Age verification status */
  ageVerified?: boolean;
  
  /** Legal drinking age for the region */
  legalDrinkingAge?: number;
  
  /** Whether to avoid alcoholic suggestions */
  avoidAlcohol?: boolean;
  
  /** Current cart items */
  cart?: Array<{
    itemId: string;
    name: string;
    quantity: number;
    priceInCents: number;
  }>;
  
  /** Available menu items */
  menu?: Array<{
    id: string;
    name: string;
    description?: string;
    priceInCents: number;
    currency: string;
    allergens?: string[];
    category?: string;
  }>;
}

/**
 * Result type for agent execution
 * Standard response format for agent API endpoints
 */
export interface AgentResult<T = unknown> {
  /** Unique session ID for the conversation */
  sessionId: string;
  
  /** Agent's structured output */
  output: T;
  
  /** Estimated cost in USD for the agent execution */
  costUsd: number;
  
  /** Additional metadata about the execution */
  metadata?: {
    /** Model used for generation */
    model: string;
    
    /** Token usage statistics */
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    
    /** Tools that were called during execution */
    toolsUsed?: string[];
    
    /** Execution time in milliseconds */
    executionTimeMs?: number;
  };
}

/**
 * Booking result type
 * Specific output format for booking agent
 */
export interface BookingResult {
  /** Natural language response */
  reply: string;
  
  /** Relevant bookings if any */
  bookings?: Array<{
    bookingId: string;
    date: string;
    time: string;
    partySize: number;
    status: 'confirmed' | 'pending' | 'cancelled';
  }>;
  
  /** Suggested next actions */
  nextSteps?: string[];
  
  /** Disclaimers or warnings */
  disclaimers?: string[];
}

/**
 * Tool execution context
 * Passed to tool functions for execution
 */
export interface ToolContext {
  /** Session identifier */
  sessionId?: string;
  
  /** Tenant identifier for multi-tenancy */
  tenantId?: string;
  
  /** User identifier */
  userId?: string;
  
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 * Standard return type for tool functions
 */
export interface ToolResult<T = unknown> {
  /** Whether the tool execution was successful */
  success: boolean;
  
  /** Tool output data */
  data?: T;
  
  /** Error message if execution failed */
  error?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent configuration
 * Settings for configuring agent behavior
 */
export interface AgentConfig {
  /** Agent name/identifier */
  name: string;
  
  /** Whether the agent is enabled */
  enabled: boolean;
  
  /** Model to use (e.g., 'gpt-4o', 'gpt-4o-mini') */
  model?: string;
  
  /** Maximum tokens for responses */
  maxTokens?: number;
  
  /** Temperature for generation (0-2) */
  temperature?: number;
  
  /** Timeout in milliseconds */
  timeoutMs?: number;
  
  /** Budget limits */
  budget?: {
    /** Maximum cost in USD per session */
    maxCostPerSession?: number;
    
    /** Maximum cost in USD per day */
    maxCostPerDay?: number;
  };
}

/**
 * API request types
 * Standard request formats for agent API endpoints
 */
export interface AgentRequest<TContext = BaseAgentContext> {
  /** User message/query */
  message: string;
  
  /** Session ID to continue existing conversation */
  sessionId?: string;
  
  /** Agent context */
  context: TContext;
  
  /** Streaming mode */
  stream?: boolean;
}

/**
 * API response types
 * Standard response formats for agent API endpoints
 */
export interface AgentResponse<TOutput = unknown> {
  /** Session ID */
  sessionId: string;
  
  /** Agent's output */
  output: TOutput;
  
  /** Cost in USD */
  costUsd: number;
  
  /** Response metadata */
  metadata?: {
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
    executionTimeMs?: number;
  };
}

/**
 * Error types
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ToolError extends Error {
  constructor(
    message: string,
    public toolName: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export class BudgetExceededError extends AgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'BUDGET_EXCEEDED', details);
    this.name = 'BudgetExceededError';
  }
}

export class AgentDisabledError extends AgentError {
  constructor(agentName: string) {
    super(`Agent ${agentName} is currently disabled`, 'AGENT_DISABLED', { agentName });
    this.name = 'AgentDisabledError';
  }
}
