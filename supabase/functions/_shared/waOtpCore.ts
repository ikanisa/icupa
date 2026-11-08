/**
 * Fail-closed WhatsApp OTP core. Actual login/session issuance is deliberately
 * NOT implemented here. A verified proof may be exchanged ONLY inside a
 * separately reviewed authenticated server transaction.
 */
export type Env = (name: string) => string | undefined;
export interface OtpStore {
  /** Atomic issue with independent durable per-phone rate accounting. */
  issue(challenge: { id: string; phoneHash: string; codeHash: string;
    expiresAt: string; maxAttempts: number }): Promise<{ accepted: boolean }>;
  markSubmitted(id: string, providerMessageId: string): Promise<void>;
  markUncertain(id: string): Promise<void>;
  /** Atomic single-use consume with expiry, attempts and submitted state. */
  consume(id: string, phoneHash: string, codeHash: string): Promise<boolean>;
}
export interface TemplateProvider {
  send(args: { to: string; code: string; senderPhoneId: string;
    template: string; language: string }): Promise<{ messageId: string }>;
}
export class OtpPaused extends Error {
  constructor(readonly reason: string) { super("WhatsApp OTP unavailable"); }
}
const e164 = /^\+[1-9][0-9]{6,14}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requireEnv = (env: Env, key: string): string => {
  const value = env(key);
  if (!value?.trim()) throw new OtpPaused("configuration_missing");
  return value;
};
function randomCode(): string {
  const sample = new Uint32Array(1);
  const limit = Math.floor(4294967296 / 1000000) * 1000000;
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return String(sample[0] % 1000000).padStart(6,"0");
}
export function createOtpCore(env: Env, store: OtpStore, provider: TemplateProvider) {
  async function mac() {
    const secret = Uint8Array.from(atob(requireEnv(env,"WA_OTP_HMAC_KEY_B64")),
      c => c.charCodeAt(0));
    if (secret.length !== 32) throw new OtpPaused("hmac_key_invalid");
    return crypto.subtle.importKey("raw",secret,
      {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  }
  async function hash(key: CryptoKey, value: string): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
    return Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
  }
  function settings() {
    if (env("WA_OTP_V2_ENABLED") !== "true") throw new OtpPaused("disabled");
    const sender = requireEnv(env,"WA_OTP_SENDER_ID");
    const allowed=(env("WA_OTP_ALLOWED_SENDER_IDS")??"").split(",").map(v=>v.trim());
    if (!/^[0-9]{5,30}$/.test(sender) || sender==="396791596844039" ||
        !allowed.includes(sender)) throw new OtpPaused("sender_not_allowed");
    const template = requireEnv(env,"WA_OTP_APPROVED_TEMPLATE");
    const language = requireEnv(env,"WA_OTP_TEMPLATE_LANGUAGE");
    if (!/^[a-z][a-z0-9_]{0,127}$/.test(template) ||
        !/^[a-z]{2}(_[A-Z]{2})?$/.test(language))
      throw new OtpPaused("template_invalid");
    return {sender,template,language};
  }
  return {
    async request(phone: string): Promise<{ id: string; status: "requested" }> {
      const cfg=settings();
      if (!e164.test(phone)) throw new OtpPaused("phone_invalid");
      const ttl=Number(env("WA_OTP_TTL_SECONDS")??"300");
      if (!Number.isInteger(ttl) || ttl < 60 || ttl > 600)
        throw new OtpPaused("ttl_invalid");
      const key=await mac(), id=crypto.randomUUID(), code=randomCode();
      const phoneHash=await hash(key,"phone|"+phone);
      const codeHash=await hash(key,"code|"+id+"|"+phone+"|"+code);
      const saved=await store.issue({id,phoneHash,codeHash,
        expiresAt:new Date(Date.now()+ttl*1000).toISOString(),maxAttempts:5});
      if (!saved.accepted) throw new OtpPaused("rate_limited");
      try {
        const result=await provider.send({
          to:phone,code,senderPhoneId:cfg.sender,template:cfg.template,language:cfg.language
        });
        if (!result?.messageId) throw new Error("provider_receipt_missing");
        await store.markSubmitted(id,result.messageId);
        return {id,status:"requested"};
      } catch {
        try { await store.markUncertain(id); } catch {}
        throw new OtpPaused("delivery_unconfirmed");
      }
    },
    async verify(phone: string, id: string, code: string): Promise<boolean> {
      settings();
      if (!e164.test(phone) || !uuid.test(id) || !/^[0-9]{6}$/.test(code))
        return false;
      const key=await mac();
      const phoneHash=await hash(key,"phone|"+phone);
      const codeHash=await hash(key,"code|"+id+"|"+phone+"|"+code);
      // A true result MUST NOT be returned as an authenticated user session.
      return store.consume(id,phoneHash,codeHash);
    }
  };
}
