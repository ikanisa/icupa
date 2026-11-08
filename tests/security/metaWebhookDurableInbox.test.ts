import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDurableInbox } from "../../supabase/functions/meta-wa-webhook/inbox.ts";

const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const base = {
  SUPABASE_URL: "https://isolated-example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-key-not-real",
  WA_SUPABASE_EXPECTED_HOST: "isolated-example.supabase.co",
  WA_WEBHOOK_AES256_KEY_B64: key,
  WA_WEBHOOK_KEY_VERSION: "test-v1",
};
const env = (overrides: Record<string,string> = {}) =>
  (name: string): string | undefined => ({ ...base, ...overrides })[name];

function input() {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "12345678912345",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { phone_number_id: "98765432198765" },
          messages: [{ id: "wamid.synthetic", type: "text", timestamp: "1470000000",
                       text: { body: "synthetic-test" } }],
          statuses: [{ id: "wamid.synthetic", status: "delivered", timestamp: "1470000001" }],
        },
      }],
    }],
  };
  return {
    payload,
    rawBody: new TextEncoder().encode(JSON.stringify(payload)),
    bodySha256: "a".repeat(64),
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("isolated durable Meta inbox", () => {
  it("seals exact bytes before service-only RPC, waits for atomic receipt", async () => {
    let body: Record<string,any> | undefined;
    const fetcher=vi.fn(async (url: URL | string, opts: RequestInit) => {
      expect(String(url)).toBe(
        "https://isolated-example.supabase.co/rest/v1/rpc/wa_ingest_verified_envelope"
      );
      expect(opts.redirect).toBe("error");
      const headers=opts.headers as Record<string,string>;
      expect(headers.apikey).toBe("synthetic-test-key-not-real");
      body=JSON.parse(String(opts.body));
      return Response.json({ committed:true,events:2 });
    });
    vi.stubGlobal("fetch",fetcher);
    const receipt=await createSupabaseDurableInbox(env()).persist(input());
    expect(receipt).toEqual({committed:true});
    expect(body!.p_events).toHaveLength(2);
    expect(body!.p_events[0].kind).toBe("message");
    expect(body!.p_events[1].kind).toBe("status");
    expect(body!.p_events[0].event_key).toMatch(/^[0-9a-f]{64}$/);
    expect(body!.p_envelope.ciphertext_b64).not.toContain("synthetic-test");
    const rawKey=Uint8Array.from(atob(key),x=>x.charCodeAt(0));
    const iv=Uint8Array.from(atob(body!.p_envelope.nonce_b64),x=>x.charCodeAt(0));
    const cipher=Uint8Array.from(atob(body!.p_envelope.ciphertext_b64),x=>x.charCodeAt(0));
    const cryptoKey=await crypto.subtle.importKey("raw",rawKey,{name:"AES-GCM"},false,["decrypt"]);
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv},cryptoKey,cipher);
    expect(new Uint8Array(decrypted)).toEqual(input().rawBody);
  });
  it("fails closed on wrong host without attempting network", async () => {
    const fetcher=vi.fn();
    vi.stubGlobal("fetch",fetcher);
    await expect(createSupabaseDurableInbox(env({WA_SUPABASE_EXPECTED_HOST:"attacker.example"}))
      .persist(input())).rejects.toThrow("untrusted RPC host");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails closed on missing encryption key", async () => {
    const fetcher=vi.fn();
    vi.stubGlobal("fetch",fetcher);
    await expect(createSupabaseDurableInbox(env({WA_WEBHOOK_AES256_KEY_B64:""}))
      .persist(input())).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("never acknowledges rejected/ambiguous RPC responses", async () => {
    vi.stubGlobal("fetch",vi.fn(async()=>new Response("unavailable",{status:503})));
    await expect(createSupabaseDurableInbox(env()).persist(input()))
      .rejects.toThrow("durable RPC rejected receipt");
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({committed:false,events:2})));
    await expect(createSupabaseDurableInbox(env()).persist(input()))
      .rejects.toThrow("durable RPC receipt invalid");
  });
  it("refuses a partial event count", async () => {
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({committed:true,events:1})));
    await expect(createSupabaseDurableInbox(env()).persist(input()))
      .rejects.toThrow("durable RPC receipt invalid");
  });
  it("does not silently accept an empty verified envelope", async () => {
    const fetcher=vi.fn();
    vi.stubGlobal("fetch",fetcher);
    await expect(createSupabaseDurableInbox(env()).persist({
      rawBody:new TextEncoder().encode("{}"),
      payload:{ entry:[] },bodySha256:"b".repeat(64)
    })).rejects.toThrow("event count invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
