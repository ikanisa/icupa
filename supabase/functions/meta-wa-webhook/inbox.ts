import type { DurableInbox, Payload } from "../_shared/metaWebhookGuard.ts";

type Env = (name: string) => string | undefined;
type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
const encoder = new TextEncoder();

function required(env: Env, name: string): string {
  const value = env(name);
  if (!value || !value.trim()) throw new Error(name + " unconfigured");
  return value;
}
function canonical(value: Json): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return "{" + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
async function sha(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  return Array.from(digest,b => b.toString(16).padStart(2,"0")).join("");
}
function b64(bytes: Uint8Array): string {
  let str = "";
  for (let i=0;i<bytes.length;i+=8192)
    str += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(str);
}
function eventRows(payload: Payload): Promise<Record<string,string>[]> {
  const rows: Array<Promise<Record<string,string>>> = [];
  for (const entry of payload.entry as Array<Record<string,unknown>>) {
    const waba = String(entry.id);
    for (const change of entry.changes as Array<Record<string,unknown>>) {
      const v = change.value as Record<string,unknown>;
      const phone = String((v.metadata as Record<string,unknown>).phone_number_id);
      for (const [field,kind] of [["messages","message"],["statuses","status"]] as const) {
        for (const raw of (v[field] ?? []) as Array<Record<string,unknown>>) {
          const id=String(raw.id), status=kind==="status"?String(raw.status):"";
          const ts=typeof raw.timestamp==="string"?raw.timestamp:"";
          const identity=canonical([waba,phone,kind,id,status,ts] as Json);
          rows.push(Promise.all([sha(identity),sha(canonical(raw as Json))])
            .then(([eventKey,eventSha])=>({
              event_key:eventKey,event_sha:eventSha,waba_id:waba,
              phone_number_id:phone,kind,provider_event_id:id,
              provider_status:status,provider_timestamp:ts
            })));
        }
      }
    }
  }
  return Promise.all(rows);
}

/** Committed receipts only: raw event content is encrypted before leaving Edge. */
export function createSupabaseDurableInbox(env: Env): DurableInbox {
  return {
    async persist({ rawBody,payload,bodySha256 }) {
      const projectUrl=required(env,"SUPABASE_URL");
      const authKey=required(env,"SUPABASE_SERVICE_ROLE_KEY");
      const expectedHost=required(env,"WA_SUPABASE_EXPECTED_HOST");
      const k=required(env,"WA_WEBHOOK_AES256_KEY_B64");
      const url=new URL(projectUrl);
      if (url.protocol!=="https:" || url.hostname!==expectedHost ||
          url.username || url.password || url.search || url.hash)
        throw new Error("untrusted RPC host");
      const decoded=Uint8Array.from(atob(k), c=>c.charCodeAt(0));
      if (decoded.length!==32) throw new Error("invalid encryption key length");
      const key=await crypto.subtle.importKey("raw",decoded,{name:"AES-GCM"},false,["encrypt"]);
      const nonce=crypto.getRandomValues(new Uint8Array(12));
      const ciphertext=new Uint8Array(await crypto.subtle.encrypt(
        {name:"AES-GCM",iv:nonce},key,rawBody
      ));
      const events=await eventRows(payload);
      if (!events.length || events.length>1000) throw new Error("event count invalid");
      const endpoint=new URL("/rest/v1/rpc/wa_ingest_verified_envelope",url);
      const response=await fetch(endpoint,{
        method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),
        headers:{
          "Content-Type":"application/json",
          "Accept":"application/json",
          "apikey":authKey,
          "Authorization":"Bearer "+authKey
        },
        body:JSON.stringify({
          p_envelope:{
            body_sha:bodySha256,ciphertext_b64:b64(ciphertext),
            nonce_b64:b64(nonce),key_version:required(env,"WA_WEBHOOK_KEY_VERSION")
          },
          p_events:events
        })
      });
      if (!response.ok) throw new Error("durable RPC rejected receipt");
      const receipt=await response.json();
      if (!receipt || receipt.committed!==true || receipt.events!==events.length)
        throw new Error("durable RPC receipt invalid");
      return {committed:true};
    }
  };
}
