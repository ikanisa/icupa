import WebSocket from 'ws';
import { log, logError, backoff } from './utils.js';

export interface RealtimeSessionConfig {
  model?: string;
  voice?: string;
  modalities?: string[];
  instructions?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface RealtimeSession {
  ws: WebSocket;
  sessionId: string;
}

/**
 * Create an OpenAI Realtime session with ephemeral key
 * 
 * @param config - Session configuration options
 * @returns WebSocket connection and session info
 */
export async function createRealtimeSession(
  config: RealtimeSessionConfig = {}
): Promise<RealtimeSession> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const model = config.model || process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
  const voice = config.voice || process.env.OPENAI_REALTIME_VOICE || 'verse';

  const sessionConfig = {
    model,
    voice,
    modalities: config.modalities || ['text', 'audio'],
    instructions: config.instructions || 'You are a helpful voice assistant.',
    temperature: config.temperature || 0.8,
    max_output_tokens: config.maxOutputTokens || 4096,
  };

  log('Creating Realtime session', { model, voice });

  // Create ephemeral session token
  const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sessionConfig),
  });

  if (!sessionResponse.ok) {
    const errorText = await sessionResponse.text();
    throw new Error(`Failed to create Realtime session: ${sessionResponse.status} ${errorText}`);
  }

  const sessionData = await sessionResponse.json() as any;
  const clientSecret = sessionData.client_secret?.value;

  if (!clientSecret) {
    throw new Error('No client_secret in session response');
  }

  // Connect to Realtime WebSocket
  const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
  
  const ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${clientSecret}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  // Wait for WebSocket to open
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 10000);

    ws.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  log('Realtime WebSocket connected', { sessionId: sessionData.id });

  return {
    ws,
    sessionId: sessionData.id,
  };
}

/**
 * Create Realtime session with retry logic
 */
export async function createRealtimeSessionWithRetry(
  config: RealtimeSessionConfig = {},
  maxRetries = 3
): Promise<RealtimeSession> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await createRealtimeSession(config);
    } catch (error) {
      logError(`Failed to create Realtime session (attempt ${attempt + 1}/${maxRetries})`, error);
      
      if (attempt < maxRetries - 1) {
        await backoff(attempt);
      } else {
        throw error;
      }
    }
  }

  throw new Error('Exhausted retries creating Realtime session');
}
