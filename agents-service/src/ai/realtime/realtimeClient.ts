import * as WebSocket from "ws";
import * as pino from "pino";
import { supabaseClient } from "../../supabase";

type ToolCall = { call_id: string; name: string; arguments: unknown; };

export interface RealtimeClientOptions {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  tools: ReturnType<typeof buildToolsSpec>;
  logger?: any;
}

export class RealtimeClient {
  private ws!: WebSocket;
  private log: any;
  private opts: RealtimeClientOptions;

  constructor(opts: RealtimeClientOptions) {
    this.opts = opts;
    this.log = opts.logger ?? pino({ level: process.env.LOG_LEVEL ?? "info" });
  }

  async connect() {
    const { url, apiKey, model } = this.opts;
    this.ws = new WebSocket(`${url}?model=${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    this.ws.on("message", (buf) => this.onMessage(buf));
    this.ws.on("error", (err) => this.log.error({ err }, "ws error"));
    this.ws.on("close", (c, r) => this.log.warn({ code: c, reason: r.toString() }, "ws closed"));

    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", async () => {
        try { await this.bootstrapSession(); resolve(); } catch (e) { reject(e); }
      });
      this.ws.once("error", reject);
    });
  }

  private send(event: Record<string, unknown>) {
    const payload = JSON.stringify(event);
    this.log.debug({ event }, "→ openai");
    this.ws.send(payload);
  }

  private async bootstrapSession() {
    this.send({
      type: "session.update",
      session: {
        instructions: this.opts.system,
        modalities: ["text"],
        turn_detection: { type: "server_vad" }
      }
    });
    this.send({ type: "tools.update", tools: this.opts.tools });
  }

  switchPersona(system: string, tools: ReturnType<typeof buildToolsSpec>) {
    this.opts.system = system;
    this.opts.tools = tools;
    this.send({ type: "session.update", session: { instructions: system } });
    this.send({ type: "tools.update", tools });
  }

  async say(text: string) {
    this.send({
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
      if (msg.type === "response.output_text.delta") process.stdout.write(msg.delta);
      if (msg.type === "response.output_text.done") process.stdout.write("\n");
      if (msg.type === "response.tool_call") this.handleToolCall({
        call_id: msg.call_id, name: msg.name, arguments: msg.arguments
      });
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
    this.send({ type: "tool.output", call_id, output });
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
      // Stub fallback for demo
      return { 
        items: [{ 
          id: "cappuccino", 
          name: "Cappuccino", 
          price: "RWF 2500",
          description: "Rich espresso with steamed milk",
          image_url: null
        }] 
      };
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
      // Stub fallback for demo
      return { upsell: "Try a croissant with that cappuccino for +RWF 1500." };
    }
  }

  private async fetchFinancials(args: { period: string }) {
    try {
      // This would query a gl_lines or materialized view
      // For now, return stub data
      this.log.info({ period: args.period }, "fetch_financials called");
      return { 
        period: args.period, 
        pnl: { 
          revenue: 125000, 
          cogs: 42000, 
          ebitda: 38000 
        },
        note: "Demo data - integrate with actual GL tables"
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
        rule: "EU VAT OSS", 
        note: "Distance-selling thresholds apply; confirm country rate.",
        jurisdiction: args.jurisdiction,
        topic: args.topic,
        demo: "Integrate with actual tax_rules table"
      };
    } catch (err) {
      this.log.error({ err }, "check_tax_rule exception");
      return { error: String(err) };
    }
  }
}

export function buildToolsSpec(tools: Array<{ name: string; description: string; schema: any }>) {
  return tools.map(t => ({ type: "function", name: t.name, description: t.description, parameters: t.schema }));
}
