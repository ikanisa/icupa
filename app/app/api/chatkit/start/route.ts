import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";

type StartRequest = {
  userId?: string;
  stateVariables?: Record<string, string | number | boolean>;
};

type ErrorResponse = {
  error: string;
};

type StartResponse = {
  clientSecret: string;
  expiresAt: number;
  sessionId: string;
  userId: string;
};

const ROUTER_AGENT_ID = process.env.OPENAI_ROUTER_AGENT_ID;
const API_KEY = process.env.OPENAI_API_KEY;
const DOMAIN_KEY = process.env.CHATKIT_DOMAIN_KEY;

function missingConfig(message: string, status = 500) {
  return NextResponse.json({ error: message } satisfies ErrorResponse, { status });
}

async function createSession(userId: string, stateVariables?: StartRequest["stateVariables"]) {
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
    return missingConfig("Server missing OPENAI_API_KEY", 500);
  }

  if (!ROUTER_AGENT_ID) {
    return missingConfig("Server missing OPENAI_ROUTER_AGENT_ID", 500);
  }

  if (!DOMAIN_KEY) {
    return missingConfig("Server missing CHATKIT_DOMAIN_KEY", 500);
  }

  const headerKey = request.headers.get("x-chatkit-domain-key");
  if (!headerKey || headerKey !== DOMAIN_KEY) {
    return NextResponse.json(
      { error: "Invalid domain key" } satisfies ErrorResponse,
      { status: 403 },
    );
  }

  let body: StartRequest | null = null;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      body = (await request.json()) as StartRequest;
    } catch (error) {
      console.error("Failed parsing /api/chatkit/start payload", error);
      return NextResponse.json(
        { error: "Invalid JSON payload" } satisfies ErrorResponse,
        { status: 400 },
      );
    }
  }

  const userId = body?.userId && body.userId.trim().length > 0 ? body.userId : randomUUID();

  try {
    const session = await createSession(userId, body?.stateVariables);
    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        expiresAt: session.expires_at,
        sessionId: session.id,
        userId: session.user,
      } satisfies StartResponse,
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to create ChatKit session", error);
    return NextResponse.json(
      { error: "Unable to start chat session" } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}
