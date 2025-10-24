import { NextResponse } from "next/server";
import OpenAI from "openai";

type RefreshRequest = {
  userId: string;
  stateVariables?: Record<string, string | number | boolean>;
};

type RefreshResponse = {
  clientSecret: string;
  expiresAt: number;
  sessionId: string;
  userId: string;
};

type ErrorResponse = {
  error: string;
};

const ROUTER_AGENT_ID = process.env.OPENAI_ROUTER_AGENT_ID;
const API_KEY = process.env.OPENAI_API_KEY;
const DOMAIN_KEY = process.env.CHATKIT_DOMAIN_KEY;

function configMissing(name: string) {
  return NextResponse.json({ error: `${name} is not configured` } satisfies ErrorResponse, {
    status: 500,
  });
}

async function issueSession(userId: string, stateVariables?: RefreshRequest["stateVariables"]) {
  if (!API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!ROUTER_AGENT_ID) {
    throw new Error("OPENAI_ROUTER_AGENT_ID is not configured");
  }

  const client = new OpenAI({ apiKey: API_KEY });
  return client.beta.chatkit.sessions.create({
    user: userId,
    workflow: {
      id: ROUTER_AGENT_ID,
      ...(stateVariables ? { state_variables: stateVariables } : {}),
    },
  });
}

export async function POST(request: Request) {
  if (!API_KEY) {
    return configMissing("OPENAI_API_KEY");
  }
  if (!ROUTER_AGENT_ID) {
    return configMissing("OPENAI_ROUTER_AGENT_ID");
  }
  if (!DOMAIN_KEY) {
    return configMissing("CHATKIT_DOMAIN_KEY");
  }

  const headerKey = request.headers.get("x-chatkit-domain-key");
  if (!headerKey || headerKey !== DOMAIN_KEY) {
    return NextResponse.json(
      { error: "Invalid domain key" } satisfies ErrorResponse,
      { status: 403 },
    );
  }

  let body: RefreshRequest | null = null;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      body = (await request.json()) as RefreshRequest;
    } catch (error) {
      console.error("Failed parsing /api/chatkit/refresh payload", error);
      return NextResponse.json(
        { error: "Invalid JSON payload" } satisfies ErrorResponse,
        { status: 400 },
      );
    }
  }

  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  try {
    const session = await issueSession(userId, body?.stateVariables);
    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        expiresAt: session.expires_at,
        sessionId: session.id,
        userId: session.user,
      } satisfies RefreshResponse,
      { status: 200 },
    );
  } catch (error) {
    console.error("Unable to refresh ChatKit session", error);
    return NextResponse.json(
      { error: "Unable to refresh chat session" } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}
