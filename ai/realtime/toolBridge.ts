import { callTool } from "../tooling/callTool";

/**
 * Bridge between Realtime API tool calls and our tool implementations
 * Handles tool call events from voice sessions
 */

export interface RealtimeToolCallEvent {
  type: "call_tool";
  id: string;
  name: string;
  arguments: any;
}

export interface RealtimeToolOutputEvent {
  type: "tool_output";
  call_id: string;
  output: string;
}

/**
 * Handle a tool call from the Realtime API
 * @param event - Tool call event from Realtime API
 * @returns Tool output event to send back to Realtime API
 */
export async function handleRealtimeToolCall(
  event: RealtimeToolCallEvent
): Promise<RealtimeToolOutputEvent> {
  try {
    const output = await callTool(event.name, event.arguments);
    return {
      type: "tool_output",
      call_id: event.id,
      output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      type: "tool_output",
      call_id: event.id,
      output: JSON.stringify({ success: false, error: errorMessage }),
    };
  }
}
