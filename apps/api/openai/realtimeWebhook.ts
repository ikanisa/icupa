/**
 * OpenAI Realtime API webhook handler
 * Handles tool call callbacks from voice sessions
 */
import {
  handleRealtimeToolCall,
  type RealtimeToolCallEvent,
  type RealtimeToolOutputEvent,
} from "../../../ai/realtime/toolBridge";

/**
 * Handle Realtime API webhook events
 * This endpoint receives tool call events from OpenAI Realtime sessions
 */
export async function handleRealtimeWebhook(body: any): Promise<{
  status: number;
  body: any;
}> {
  try {
    const event = body;

    // Handle tool call events
    if (event?.type === "call_tool") {
      const toolCallEvent: RealtimeToolCallEvent = {
        type: "call_tool",
        id: event.id,
        name: event.name,
        arguments: event.arguments,
      };

      const output = await handleRealtimeToolCall(toolCallEvent);
      return { status: 200, body: output };
    }

    // Unknown event type - just acknowledge
    return { status: 200, body: { ok: true } };
  } catch (error) {
    console.error("Realtime webhook error:", error);
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}

/**
 * Start a Realtime session
 * Initiates a SIP session with OpenAI Realtime API
 */
export async function startRealtimeSession(
  sdpOffer: string,
  instructions?: string
): Promise<{ status: number; body: any }> {
  try {
    const { startSipSession } = await import("../../../ai/realtime/sipSession");
    const { tools } = await import("../../../ai/responses/router");
    const { VOICE_SYSTEM_PROMPT } = await import(
      "../../../ai/responses/prompts"
    );

    const sessionInstructions = instructions || VOICE_SYSTEM_PROMPT;

    const toolSpecs = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema,
      },
    }));

    const result = await startSipSession(sdpOffer, sessionInstructions, toolSpecs);

    return {
      status: 200,
      body: {
        sdp_answer: result.sdpAnswer,
        session_id: `session_${Date.now()}`,
      },
    };
  } catch (error) {
    console.error("Failed to start Realtime session:", error);
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}
