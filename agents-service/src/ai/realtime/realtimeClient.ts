import * as WebSocket from "ws";
import * as pino from "pino";
import { supabaseClient } from "../../supabase";

type ToolCall = { call_id: string; name: string; arguments: unknown; };

// Fallback stub data for demo/testing purposes
const FALLBACK_DATA = {
  menu: {
    items: [{
      id: "cappuccino",
      name: "Cappuccino",
      price: "RWF 2500",
      description: "Rich espresso with steamed milk",
      image_url: null
    }]
  },
  pairing: {
    upsell: "Try a croissant with that cappuccino for +RWF 1500."
  },
  financials: {
    pnl: {
      revenue: 125000,
      cogs: 42000,
      ebitda: 38000
    },
    note: "Demo data - integrate with actual GL tables"
  },
  taxRule: {
    rule: "EU VAT OSS",
    note: "Distance-selling thresholds apply; confirm country rate.",
    demo: "Integrate with actual tax_rules table"
  }
} as const;

export interface RealtimeClientOptions {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  tools: ReturnType<typeof buildToolsSpec>;
  logger?: any;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private log: any;
  private opts: RealtimeClientOptions;
  private ready = false;
  private connectPromise: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(opts: RealtimeClientOptions) {
    this.opts = opts;
    this.log = opts.logger ?? pino({ level: process.env.LOG_LEVEL ?? "info" });
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const { url, apiKey, model } = this.opts;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${url}?model=${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });

      const handleOpen = async () => {
        ws.off("error", handleInitialError);

        this.ws = ws;
        this.attachSocket(ws);

        try {
          await this.bootstrapSession();
          this.ready = true;
          this.connectPromise = null;
          this.log.info("Realtime websocket connected");
          resolve();
        } catch (err) {
          this.ready = false;
          this.connectPromise = null;
          this.log.error({ err }, "failed to bootstrap realtime session");
          ws.close();
          reject(err);
        }
      };

      const handleInitialError = (err: Error) => {
        ws.off("open", handleOpen);
        this.connectPromise = null;
        this.log.error({ err }, "Realtime websocket connection error");
        reject(err);
      };

      ws.once("open", handleOpen);
      ws.once("error", handleInitialError);
    });

    return this.connectPromise;
  }

  private attachSocket(ws: WebSocket) {
    ws.on("message", (buf: WebSocket.RawData) => this.onMessage(buf));
    ws.on("error", (err: Error) => this.handleSocketError(err));
    ws.on("close", (code: number, reason: Buffer) => this.handleClose(code, reason));
  }

  private handleSocketError(err: Error) {
    this.log.error({ err }, "ws error");
  }

  private handleClose(code: number, reason: Buffer) {
    this.log.warn({ code, reason: reason.toString() }, "ws closed");
    this.ready = false;
    this.ws = null;
    this.connectPromise = null;
    this.scheduleReconnect();
  }

  private async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    await this.connect();
  }

  private sendRaw(event: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }

    const payload = JSON.stringify(event);
    this.log.debug({ event }, "→ openai");
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime socket is not connected");
    }
    this.ws.send(payload);
  }

  private async send(event: Record<string, unknown>) {
    await this.ensureConnected();
    this.sendRaw(event);
  }

  private async bootstrapSession() {
    this.sendRaw({
      type: "session.update",
      session: {
        instructions: this.opts.system,
        modalities: ["text"],
        turn_detection: { type: "server_vad" }
      }
    });
    this.sendRaw({ type: "tools.update", tools: this.opts.tools });
  }

  async switchPersona(system: string, tools: ReturnType<typeof buildToolsSpec>) {
    this.opts.system = system;
    this.opts.tools = tools;
    await this.send({ type: "session.update", session: { instructions: system } });
    await this.send({ type: "tools.update", tools });
  }

  async say(text: string) {
    await this.send({
      type: "response.create",
      response: {
        modalities: ["text"],
        input: [{ role: "user", content: [{ type: "input_text", text }]}],
        tool_choice: "auto"
      }
    });
  }

  private onMessage(raw: WebSocket.RawData) {
    try {
      const msg = JSON.parse(raw.toString());
      this.log.debug({ msg }, "← openai");
      
      // Log text deltas for observability (avoid direct stdout writes in production)
      if (msg.type === "response.output_text.delta") {
        this.log.debug({ delta: msg.delta }, "text delta received");
        process.stdout.write(msg.delta);
      }
      if (msg.type === "response.output_text.done") {
        this.log.debug("text output complete");
        process.stdout.write("\n");
      }
      
      if (msg.type === "response.tool_call") {
        void this.handleToolCall({
          call_id: msg.call_id, name: msg.name, arguments: msg.arguments
        });
      }
      if (msg.type === "error") this.log.error({ err: msg }, "realtime error");
    } catch (e) {
      this.log.error({ e }, "failed to parse ws message");
    }
  }

  private async handleToolCall(call: ToolCall) {
    const { call_id, name, arguments: args } = call;
    let output: unknown;
    try {
      switch (name) {
        case "lookup_menu":
          output = await this.lookupMenu(args as { query: string });
          break;
        case "recommend_pairing":
          output = await this.recommendPairing(args as { itemId: string });
          break;
        case "fetch_financials":
          output = await this.fetchFinancials(args as { period: string });
          break;
        case "check_tax_rule":
          output = await this.checkTaxRule(args as { jurisdiction: string; topic: string });
          break;
        default:
          output = { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      output = { error: String(err) };
    }
    await this.send({ type: "tool.output", call_id, output });
  }

  private async lookupMenu(args: { query: string }) {
    try {
      const { data, error } = await supabaseClient
        .from('menu_items')
        .select('id, name, price_cents, currency, description, image_url')
        .ilike('name', `%${args.query}%`)
        .limit(5);
      
      if (error) {
        this.log.error({ error }, "lookup_menu error");
        return { items: [], error: error.message };
      }

      return { 
        items: (data ?? []).map(item => ({
          id: item.id,
          name: item.name,
          price: `${item.currency} ${(item.price_cents / 100).toFixed(2)}`,
          description: item.description,
          image_url: item.image_url
        }))
      };
    } catch (err) {
      this.log.error({ err }, "lookup_menu exception");
      // Return stub fallback for demo
      return FALLBACK_DATA.menu;
    }
  }

  private async recommendPairing(args: { itemId: string }) {
    try {
      const { data, error } = await supabaseClient
        .from('pairings')
        .select('text')
        .eq('item_id', args.itemId)
        .limit(1)
        .single();
      
      if (error) {
        this.log.error({ error }, "recommend_pairing error");
        return { upsell: null, error: error.message };
      }

      return { upsell: data?.text ?? null };
    } catch (err) {
      this.log.error({ err }, "recommend_pairing exception");
      // Return stub fallback for demo
      return FALLBACK_DATA.pairing;
    }
  }

  private async fetchFinancials(args: { period: string }) {
    try {
      // This would query a gl_lines or materialized view
      // For now, return stub data
      this.log.info({ period: args.period }, "fetch_financials called");
      return { 
        period: args.period,
        ...FALLBACK_DATA.financials
      };
    } catch (err) {
      this.log.error({ err }, "fetch_financials exception");
      return { error: String(err) };
    }
  }

  private async checkTaxRule(args: { jurisdiction: string; topic: string }) {
    try {
      // This would query a tax_rules table
      this.log.info(args, "check_tax_rule called");
      return {
        ...FALLBACK_DATA.taxRule,
        jurisdiction: args.jurisdiction,
        topic: args.topic
      };
    } catch (err) {
      this.log.error({ err }, "check_tax_rule exception");
      return { error: String(err) };
    }
  }

  private scheduleReconnect(delayMs = 1000) {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        if (this.ready) {
          this.log.info("Realtime websocket reconnected");
        }
      } catch (err) {
        this.log.error({ err }, "Realtime websocket reconnect failed");
        this.scheduleReconnect(Math.min(delayMs * 2, 10000));
      }
    }, delayMs);
  }
}

export function buildToolsSpec(tools: Array<{ name: string; description: string; schema: any }>) {
  return tools.map(t => ({ type: "function", name: t.name, description: t.description, parameters: t.schema }));
}
