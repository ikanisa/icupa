import { describe, expect, it, vi } from "vitest";
import { createOtpCore } from "../../supabase/functions/_shared/waOtpCore.ts";

const b64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(8)));
const defaults: Record<string,string> = {
  WA_OTP_V2_ENABLED:"true", WA_OTP_HMAC_KEY_B64:b64,
  WA_OTP_SENDER_ID:"561637583695258",
  WA_OTP_ALLOWED_SENDER_IDS:"561637583695258",
  WA_OTP_APPROVED_TEMPLATE:"test_approved_otp",
  WA_OTP_TEMPLATE_LANGUAGE:"en", WA_OTP_TTL_SECONDS:"300"
};
function make(overrides: Record<string,string>={}) {
  let saved: any, submitted = false, used = false, code = "";
  const store = {
    issue: vi.fn(async (row: any) => { saved=row;return {accepted:true}; }),
    markSubmitted: vi.fn(async () => { submitted=true; }),
    markUncertain: vi.fn(async () => { used=true; }),
    consume: vi.fn(async (_id:string,_ph:string,ch:string) => {
      if (!submitted || used || ch!==saved.codeHash) return false;
      used=true;return true;
    })
  };
  const provider={
    send: vi.fn(async (args: any) => {
      code=args.code;
      return {messageId:"wamid.mock-provider-accepted"};
    })
  };
  const env=(name:string)=>({...defaults,...overrides})[name];
  return {core:createOtpCore(env,store,provider),store,provider,getCode:()=>code};
}
describe("WhatsApp OTP v2 security core",()=>{
  it("never attempts a provider call without explicit release",async()=>{
    const f=make({WA_OTP_V2_ENABLED:"false"});
    await expect(f.core.request("+250788000001")).rejects.toMatchObject({reason:"disabled"});
    expect(f.store.issue).not.toHaveBeenCalled();
    expect(f.provider.send).not.toHaveBeenCalled();
  });
  it("blocks the retired Togo sender even when allowlisted",async()=>{
    const f=make({WA_OTP_SENDER_ID:"396791596844039",
      WA_OTP_ALLOWED_SENDER_IDS:"396791596844039"});
    await expect(f.core.request("+250788000001")).rejects.toMatchObject({reason:"sender_not_allowed"});
  });
  it("returns no code and verifies exactly once",async()=>{
    const f=make();
    const response=await f.core.request("+250788000001");
    expect(response).toEqual({id:expect.any(String),status:"requested"});
    expect(response).not.toHaveProperty("code");
    expect(f.getCode()).toMatch(/^[0-9]{6}$/);
    expect(f.store.issue.mock.calls[0][0].codeHash).toMatch(/^[0-9a-f]{64}$/);
    const wrong=f.getCode()==="000000"?"000001":"000000";
    expect(await f.core.verify("+250788000001",response.id,wrong)).toBe(false);
    expect(await f.core.verify("+250788000001",response.id,f.getCode())).toBe(true);
    expect(await f.core.verify("+250788000001",response.id,f.getCode())).toBe(false);
  });
  it("rejects invalid phone before issue",async()=>{
    const f=make();
    await expect(f.core.request("0788000001")).rejects.toMatchObject({reason:"phone_invalid"});
    expect(f.store.issue).not.toHaveBeenCalled();
  });
  it("fails closed if provider receipt is missing",async()=>{
    const f=make();
    f.provider.send.mockResolvedValueOnce({messageId:""});
    await expect(f.core.request("+250788000001")).rejects.toMatchObject({reason:"delivery_unconfirmed"});
    expect(f.store.markUncertain).toHaveBeenCalledOnce();
  });
  it("rejects out-of-range expiry before storing",async()=>{
    const f=make({WA_OTP_TTL_SECONDS:"3600"});
    await expect(f.core.request("+250788000001")).rejects.toMatchObject({reason:"ttl_invalid"});
    expect(f.store.issue).not.toHaveBeenCalled();
  });
});
