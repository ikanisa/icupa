/**
 * Example Booking Agent implementation following the OpenAI Agents SDK blueprint
 * 
 * This demonstrates the pattern described in the integration guide for creating
 * agents that handle booking-related tasks for the bar truck/venue system.
 */

import { Agent, tool } from '@openai/agents';
import type { RunContext } from '@openai/agents';
import { z } from 'zod';

/**
 * Context type for the booking agent
 * Extends the basic session context with booking-specific information
 */
export interface BookingAgentContext {
  userId?: string;
  tenantId?: string;
  locationId?: string;
  language?: string;
  region?: string;
}

/**
 * Tool for searching available booking slots
 * In a real implementation, this would query the database for available times
 */
const searchAvailableSlots = tool({
  name: 'search_available_slots',
  description: 'Search for available booking slots for the bar truck or venue',
  parameters: z.object({
    date: z.string().describe('Date to search for slots (ISO 8601 format)'),
    party_size: z.number().optional().describe('Number of people in the party'),
  }),
  execute: async (input) => {
    // Mock implementation - in production this would query Supabase
    return {
      available_slots: [
        { time: '18:00', capacity: 10, available: true },
        { time: '19:00', capacity: 10, available: true },
        { time: '20:00', capacity: 10, available: false },
        { time: '21:00', capacity: 10, available: true },
      ],
      message: `Found available slots for ${input.date}`,
    };
  },
});

/**
 * Tool for creating a booking reservation
 * In a real implementation, this would create a booking record in Supabase
 */
const createBooking = tool({
  name: 'create_booking',
  description: 'Create a new booking reservation',
  parameters: z.object({
    date: z.string().describe('Booking date (ISO 8601 format)'),
    time: z.string().describe('Booking time (HH:MM format)'),
    party_size: z.number().describe('Number of people'),
    customer_name: z.string().describe('Customer name'),
    customer_email: z.string().email().describe('Customer email'),
    notes: z.string().optional().describe('Special requests or notes'),
  }),
  execute: async (input) => {
    // Mock implementation - in production this would insert into Supabase
    const bookingId = `BK-${Date.now()}`;
    return {
      booking_id: bookingId,
      status: 'confirmed',
      confirmation_message: `Booking confirmed for ${input.party_size} people on ${input.date} at ${input.time}. Booking ID: ${bookingId}`,
    };
  },
});

/**
 * Tool for checking existing bookings
 * In a real implementation, this would query Supabase for user's bookings
 */
const checkExistingBookings = tool({
  name: 'check_existing_bookings',
  description: 'Check existing bookings for a customer',
  parameters: z.object({
    customer_email: z.string().email().describe('Customer email to look up'),
  }),
  execute: async (input) => {
    // Mock implementation - in production this would query Supabase
    return {
      bookings: [
        {
          booking_id: 'BK-123',
          date: '2025-11-15',
          time: '19:00',
          party_size: 4,
          status: 'confirmed',
        },
      ],
      message: `Found 1 booking for ${input.customer_email}`,
    };
  },
});

/**
 * Output schema for the booking agent responses
 */
const BookingOutputSchema = z.object({
  reply: z.string().describe('Natural language response to the user'),
  bookings: z
    .array(
      z.object({
        booking_id: z.string(),
        date: z.string(),
        time: z.string(),
        party_size: z.number(),
        status: z.string(),
      })
    )
    .optional()
    .describe('Array of relevant bookings if any'),
  next_steps: z
    .array(z.string())
    .optional()
    .describe('Suggested next actions for the user'),
});

/**
 * Booking Agent
 * 
 * This agent helps users with:
 * - Finding available booking slots
 * - Creating new reservations
 * - Checking existing bookings
 * - Answering questions about booking policies
 * 
 * It follows the multi-agent pattern from the OpenAI Agents SDK blueprint
 * and can be extended with additional tools and hand-offs as needed.
 */
export const BookingAgent = new Agent<BookingAgentContext, typeof BookingOutputSchema>({
  name: 'ICUPA Booking Agent',
  instructions: async (runContext: RunContext<BookingAgentContext>) => {
    const context = runContext.context;
    const locale = context?.language || 'English';
    const region = context?.region || 'Rwanda';

    return `You are a helpful booking assistant for ICUPA's bar truck and venue system in ${region}.

Your role:
- Help customers find available booking slots
- Create reservations when requested
- Check existing bookings
- Answer questions about booking policies and procedures

Communication style:
- Respond in ${locale}
- Be friendly, clear, and concise
- Always confirm important details (date, time, party size) before creating bookings
- Provide booking IDs and confirmation details when reservations are made

Important guidelines:
- Always use the provided tools to check availability and create bookings
- Never make up availability information
- Include prices with currency when discussing bookings
- Respect the legal drinking age and age restrictions
- For any issues or special requests beyond your tools, advise the customer to contact support

When creating a booking, always:
1. Confirm the date, time, and party size
2. Get customer name and email
3. Check availability first
4. Create the booking and provide the confirmation details`;
  },
  handoffDescription:
    'Assists with booking reservations for bar truck slots and venue tables, including availability checks and confirmation management.',
  model: 'gpt-4o',
  tools: [searchAvailableSlots, createBooking, checkExistingBookings],
  outputType: BookingOutputSchema,
});

export type BookingOutput = z.infer<typeof BookingOutputSchema>;
