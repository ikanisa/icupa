import { Request, Response } from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import { createRealtimeSessionWithRetry } from './realtimeSession.js';
import { mulawToPcm16 } from './transcode.js';
import { log, logError, generateId } from './utils.js';

interface TwilioMediaMessage {
  event: 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string;
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 encoded μ-law audio
  };
  stop?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

/**
 * Generate TwiML response for incoming calls
 */
export function handleTwilioAnswer(req: Request, res: Response): void {
  const publicWsUrl = process.env.PUBLIC_WS_URL;
  
  if (!publicWsUrl) {
    logError('PUBLIC_WS_URL not configured', new Error('Missing PUBLIC_WS_URL'));
    res.status(500).send('Server configuration error');
    return;
  }

  const requestId = generateId('req');
  log('Twilio answer webhook called', { requestId, from: req.body?.From, to: req.body?.To });

  // Generate TwiML to connect to our WebSocket
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to our AI assistant.</Say>
  <Connect>
    <Stream url="${publicWsUrl}" track="both_tracks"/>
  </Connect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
}

/**
 * Setup WebSocket server for Twilio Media Streams
 */
export function setupTwilioWebSocket(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket) => {
    const sessionId = generateId('session');
    log('Twilio WebSocket connected', { sessionId });

    let realtimeSession: Awaited<ReturnType<typeof createRealtimeSessionWithRetry>> | null = null;
    let callSid: string | null = null;
    let streamSid: string | null = null;

    try {
      // Create OpenAI Realtime session
      realtimeSession = await createRealtimeSessionWithRetry({
        instructions: 'You are a helpful voice assistant for ICUPA, a restaurant ordering system. Be concise and friendly.',
      });

      // Setup Realtime event handlers
      setupRealtimeEventHandlers(realtimeSession.ws, sessionId);

      // Handle Twilio messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message: TwilioMediaMessage = JSON.parse(data.toString());

          switch (message.event) {
            case 'start':
              callSid = message.start?.callSid || null;
              streamSid = message.start?.streamSid || null;
              log('Twilio stream started', { sessionId, callSid, streamSid });
              break;

            case 'media':
              if (message.media?.payload && realtimeSession) {
                // Decode base64 μ-law audio
                const mulawBuffer = Buffer.from(message.media.payload, 'base64');
                
                // Convert to PCM16 (stub for now)
                const pcm16Buffer = mulawToPcm16(mulawBuffer);
                
                // Convert to base64 and send to Realtime API
                const base64Audio = pcm16Buffer.toString('base64');
                
                realtimeSession.ws.send(JSON.stringify({
                  type: 'input_audio_buffer.append',
                  audio: base64Audio,
                }));
              }
              break;

            case 'stop':
              log('Twilio stream stopped', { sessionId, callSid });
              
              // Commit audio buffer and request response
              if (realtimeSession) {
                realtimeSession.ws.send(JSON.stringify({
                  type: 'input_audio_buffer.commit',
                }));
                
                realtimeSession.ws.send(JSON.stringify({
                  type: 'response.create',
                }));
              }
              break;

            case 'mark':
              // Mark events are used for timing/synchronization
              break;

            default:
              log('Unknown Twilio event', { sessionId, event: message.event });
          }
        } catch (error) {
          logError('Error processing Twilio message', error, { sessionId });
        }
      });

      ws.on('close', () => {
        log('Twilio WebSocket closed', { sessionId, callSid });
        
        // Cleanup Realtime session
        if (realtimeSession) {
          realtimeSession.ws.close();
        }
      });

      ws.on('error', (error) => {
        logError('Twilio WebSocket error', error, { sessionId, callSid });
      });

    } catch (error) {
      logError('Error setting up Twilio session', error, { sessionId });
      ws.close();
    }
  });
}

/**
 * Setup event handlers for OpenAI Realtime WebSocket
 */
function setupRealtimeEventHandlers(ws: WebSocket, sessionId: string): void {
  ws.on('message', (data: Buffer) => {
    try {
      const event = JSON.parse(data.toString());
      
      // Log significant events
      if (event.type === 'error') {
        logError('Realtime API error', new Error(event.error?.message || 'Unknown error'), {
          sessionId,
          errorType: event.error?.type,
          errorCode: event.error?.code,
        });
      } else if (event.type === 'response.done' || event.type === 'conversation.item.created') {
        log('Realtime event', { sessionId, type: event.type });
      }

      // TODO: Handle audio output events for duplex audio
      // if (event.type === 'response.audio.delta') {
      //   // Convert and send audio back to Twilio
      // }
      
    } catch (error) {
      logError('Error processing Realtime event', error, { sessionId });
    }
  });

  ws.on('error', (error) => {
    logError('Realtime WebSocket error', error, { sessionId });
  });

  ws.on('close', () => {
    log('Realtime WebSocket closed', { sessionId });
  });
}
