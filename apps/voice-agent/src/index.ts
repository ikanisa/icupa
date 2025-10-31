import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { handleTwilioAnswer, setupTwilioWebSocket } from './twilioInbound.js';
import { setupMcpServer } from './mcpServer.js';
import { log, logError } from './utils.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8787', 10);
const MCP_PORT = parseInt(process.env.MCP_PORT || '9797', 10);
const VOICE_AGENT_ENABLED = process.env.VOICE_AGENT_ENABLED === 'true';
const VOICE_AGENT_MCP_ENABLED = process.env.VOICE_AGENT_MCP_ENABLED === 'true';

// Track server start time for uptime
const startTime = Date.now();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  res.json({
    ok: true,
    version: '0.1.0',
    uptime,
    timestamp: new Date().toISOString(),
  });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  // Check if required environment variables are set
  const required = [
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PUBLIC_WS_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    res.status(503).json({
      ready: false,
      missing,
    });
    return;
  }

  res.json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

// Twilio webhook endpoint for incoming calls
app.post('/twilio/answer', (req, res) => {
  if (!VOICE_AGENT_ENABLED) {
    res.status(503).send('Voice agent is disabled');
    return;
  }

  handleTwilioAnswer(req, res);
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({ 
  server,
  path: '/ws/twilio',
});

setupTwilioWebSocket(wss);

// Setup MCP server if enabled
if (VOICE_AGENT_MCP_ENABLED) {
  try {
    setupMcpServer(MCP_PORT);
  } catch (error) {
    logError('Failed to start MCP server', error);
  }
}

// Start server
server.listen(PORT, () => {
  log('Voice agent server started', {
    port: PORT,
    mcpPort: MCP_PORT,
    voiceAgentEnabled: VOICE_AGENT_ENABLED,
    mcpEnabled: VOICE_AGENT_MCP_ENABLED,
    nodeEnv: process.env.NODE_ENV || 'development',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    log('HTTP server closed');
    process.exit(0);
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection', reason);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  process.exit(1);
});
