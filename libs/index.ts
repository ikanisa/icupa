/**
 * OpenAI Agents SDK Integration - Main exports
 * 
 * This module exports all the components needed to work with the OpenAI Agents SDK
 * in the ICUPA application.
 */

// Agent definitions
export { BookingAgent } from './agents/bookingAgent';
export type { BookingAgentContext, BookingOutput } from './agents/bookingAgent';

// Database clients
export {
  createFrontendClient,
  createBackendClient,
  createAgentClient,
  db,
} from './db/supabaseClient';

// Type definitions
export type {
  BaseAgentContext,
  BookingContext,
  MenuContext,
  AgentResult,
  BookingResult,
  ToolContext,
  ToolResult,
  AgentConfig,
  AgentRequest,
  AgentResponse,
} from './types/agents';

export {
  AgentError,
  ToolError,
  BudgetExceededError,
  AgentDisabledError,
} from './types/agents';

// API handlers
export { registerBookingRoutes } from './api/bookingHandler';

/**
 * Usage examples:
 * 
 * ```typescript
 * // Import agent
 * import { BookingAgent, type BookingAgentContext } from '@/libs';
 * 
 * // Import database client
 * import { createAgentClient } from '@/libs';
 * 
 * // Import types
 * import type { AgentResult, BookingResult } from '@/libs';
 * 
 * // Import API handler
 * import { registerBookingRoutes } from '@/libs';
 * ```
 */
