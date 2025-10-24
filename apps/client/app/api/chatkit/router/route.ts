import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE ?? "";

const LICENSE_METADATA = {
  owner: "EcoTrips",
  asset: "domain_agents",
  terms: "internal-use",
  version: "2025-09-22",
};

const COMPLIANCE_CONTEXT = {
  classification: "confidential",
  retention: "30_days",
  jurisdiction: "RW",
};

interface ChatKitMessage {
  role: string;
  content: unknown;
  metadata?: Record<string, unknown>;
}

interface ChatKitToolCall {
  key?: string;
  input?: Record<string, unknown>;
}

interface ChatKitRequestBody {
  agent?: unknown;
  session_id?: unknown;
  sessionId?: unknown;
  user_id?: unknown;
  messages?: unknown;
  tool_call?: unknown;
  dry_run?: unknown;
  compliance?: unknown;
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "supabase_config_missing" }, { status: 500 });
  }

  let payload: ChatKitRequestBody;
  try {
    payload = (await req.json()) as ChatKitRequestBody;
  } catch (error) {
    return NextResponse.json({ ok: false, error: "invalid_json", detail: String(error) }, { status: 400 });
  }

  const agent = typeof payload.agent === "string" && payload.agent ? payload.agent : "PlannerCoPilot";
  const sessionId =
    typeof payload.session_id === "string"
      ? payload.session_id
      : typeof payload.sessionId === "string"
        ? payload.sessionId
        : undefined;

  const messages = Array.isArray(payload.messages)
    ? (payload.messages as ChatKitMessage[])
    : [];

  const toolCall = payload.tool_call && typeof payload.tool_call === "object"
    ? (payload.tool_call as ChatKitToolCall)
    : undefined;

  const orchestratorBody: Record<string, unknown> = {
    agent,
    session_id: sessionId,
    messages,
    tool_call: toolCall,
    dry_run: payload.dry_run === true,
    compliance: payload.compliance ?? {},
  };

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/agent-orchestrator`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(orchestratorBody),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json({ ok: false, error: "agent_orchestrator_failed", detail }, { status: 502 });
  }

  const body = await response.json() as Record<string, unknown>;
  const toolResult = body?.tool_result as Record<string, unknown> | undefined;
  const orchestratorMessages = Array.isArray(toolResult?.messages)
    ? (toolResult?.messages as ChatKitMessage[])
    : [];

  const enrichedMessages = orchestratorMessages.map((message) => ({
    ...message,
    metadata: {
      ...(message.metadata ?? {}),
      license: LICENSE_METADATA,
      compliance: {
        ...COMPLIANCE_CONTEXT,
        agent,
        session_id: sessionId ?? null,
      },
    },
  }));

  const responseMetadata = {
    license: LICENSE_METADATA,
    compliance: {
      ...COMPLIANCE_CONTEXT,
      agent,
      session_id: sessionId ?? null,
    },
  };

  return NextResponse.json({
    ok: body?.ok !== false,
    agent,
    request_id: body?.request_id ?? body?.requestId ?? null,
    autonomy: body?.autonomy ?? null,
    messages: enrichedMessages,
    metadata: responseMetadata,
  });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
