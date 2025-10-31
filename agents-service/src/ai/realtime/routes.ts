import 'dotenv/config';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PERSONAS, PersonaKey } from './personas';
import { RealtimeClient, buildToolsSpec } from './realtimeClient';

// Derive persona keys from PERSONAS object for consistency
const personaKeys = Object.keys(PERSONAS) as PersonaKey[];

const SayRequestSchema = z.object({
  text: z.string().min(1, "text is required")
});

const PersonaRequestSchema = z.object({
  key: z.enum(personaKeys as [PersonaKey, ...PersonaKey[]])
});

// Client state management (singleton per service instance)
// Note: In production, consider using a proper singleton pattern or dependency injection
// for better testability and multi-instance support
let realtimeClient: RealtimeClient | null = null;
let currentPersona: PersonaKey = "waiter";

export async function initializeRealtimeClient(logger: any): Promise<RealtimeClient> {
  const {
    OPENAI_API_KEY,
    OPENAI_REALTIME_ENDPOINT = "wss://api.openai.com/v1/realtime",
    OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview-2024-12-17",
    DEFAULT_PERSONA = "waiter"
  } = process.env;

  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const envPersonaRaw = (DEFAULT_PERSONA as string | undefined)?.trim();
  const envPersona = envPersonaRaw ? (envPersonaRaw as PersonaKey) : undefined;
  const personaKey = envPersona ?? "waiter";

  if (envPersona && !personaKeys.includes(envPersona)) {
    logger.error({ envPersona }, "Invalid DEFAULT_PERSONA provided");
    throw new Error(
      `DEFAULT_PERSONA must be one of: ${personaKeys.join(', ')}`
    );
  }

  const persona = PERSONAS[personaKey];
  if (!persona) {
    throw new Error(`Persona configuration missing for key: ${personaKey}`);
  }

  currentPersona = personaKey;

  const client = new RealtimeClient({
    url: OPENAI_REALTIME_ENDPOINT,
    apiKey: OPENAI_API_KEY,
    model: OPENAI_REALTIME_MODEL,
    system: persona.system,
    tools: buildToolsSpec(persona.tools),
    logger
  });

  await client.connect();
  logger.info({ persona: personaKey }, "Realtime client initialized");
  
  return client;
}

export function registerRealtimeRoutes(app: FastifyInstance) {
  // Initialize client on first request (lazy init)
  const ensureClient = async () => {
    if (!realtimeClient) {
      realtimeClient = await initializeRealtimeClient(app.log);
    }
    return realtimeClient;
  };

  app.post('/ai/say', async (request, reply) => {
    const parseResult = SayRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ 
        error: 'invalid_request', 
        details: parseResult.error.issues 
      });
    }

    const { text } = parseResult.data;
    const client = await ensureClient();
    await client.say(text);
    
    return reply.send({ ok: true });
  });

  app.post('/ai/persona', async (request, reply) => {
    const parseResult = PersonaRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ 
        error: 'invalid_request', 
        details: parseResult.error.issues 
      });
    }

    const { key } = parseResult.data;
    const persona = PERSONAS[key];
    
    const client = await ensureClient();
    await client.switchPersona(persona.system, buildToolsSpec(persona.tools));
    currentPersona = key;
    
    // Use type casting to work around Fastify logger type mismatch
    (app.log as any).info({ persona: key }, "Switched persona");
    
    return reply.send({ ok: true, active: key });
  });

  app.get('/ai/healthz', async (_, reply) => {
    return reply.send({ 
      ok: true, 
      persona: currentPersona,
      realtime_enabled: process.env.AI_REALTIME_ENABLED !== 'false'
    });
  });
}
