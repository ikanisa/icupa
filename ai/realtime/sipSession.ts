/**
 * SIP Session handler for OpenAI Realtime API
 * Manages SIP/WebRTC sessions with OpenAI's voice model
 */

const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";

/**
 * Start a SIP session with OpenAI Realtime API
 * @param sdpOffer - SDP offer from the SIP client
 * @param sessionInstructions - Instructions for the AI agent
 * @param toolSpecs - Tool specifications for function calling
 * @returns SDP answer and session info
 */
export async function startSipSession(
  sdpOffer: string,
  sessionInstructions: string,
  toolSpecs: any[]
): Promise<{ sdpAnswer: string; toolSpecs: any[] }> {
  const sessionConfig = {
    instructions: sessionInstructions,
    tools: toolSpecs,
  };

  const encodedConfig = Buffer.from(JSON.stringify(sessionConfig), "utf8").toString(
    "base64"
  );

  const resp = await fetch(
    `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
        "X-Session-Instruction": sessionInstructions,
        "X-OpenAI-Session-Config": encodedConfig,
      },
      body: sdpOffer,
    }
  );

  if (!resp.ok) {
    throw new Error(
      `Realtime API failed: ${resp.status} ${await resp.text()}`
    );
  }

  // Provider returns an SDP answer stream or a session
  const sdpAnswer = await resp.text();
  return { sdpAnswer, toolSpecs };
}
