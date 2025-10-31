import WebSocket, { WebSocketServer } from 'ws';
import { log, logError } from './utils.js';
import { getMemberBalance, redeemVoucher } from './tools/supabaseTool.js';

interface McpToolCall {
  id: string;
  method: 'tool.call';
  params: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface McpResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Setup MCP WebSocket server for tool calls
 */
export function setupMcpServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  log('MCP server started', { port });

  wss.on('connection', (ws: WebSocket) => {
    log('MCP client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const request: McpToolCall = JSON.parse(data.toString());

        if (request.method !== 'tool.call') {
          sendError(ws, request.id, -32601, 'Method not found');
          return;
        }

        const { name, args } = request.params;
        log('MCP tool call', { tool: name, args });

        try {
          const result = await handleToolCall(name, args);
          sendResult(ws, request.id, result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendError(ws, request.id, -32603, errorMessage);
        }

      } catch (error) {
        logError('Error processing MCP message', error);
      }
    });

    ws.on('error', (error) => {
      logError('MCP WebSocket error', error);
    });

    ws.on('close', () => {
      log('MCP client disconnected');
    });
  });

  return wss;
}

/**
 * Route tool calls to appropriate handlers
 */
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_member_balance':
      return await getMemberBalance(args);
    
    case 'redeem_voucher':
      return await redeemVoucher(args);
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Send successful result back to MCP client
 */
function sendResult(ws: WebSocket, id: string, result: unknown): void {
  const response: McpResponse = { id, result };
  ws.send(JSON.stringify(response));
}

/**
 * Send error back to MCP client
 */
function sendError(ws: WebSocket, id: string, code: number, message: string, data?: unknown): void {
  const response: McpResponse = {
    id,
    error: { code, message, data },
  };
  ws.send(JSON.stringify(response));
}
