import {
  createVoucher,
  lookupCustomer,
  redeemVoucher,
  voidVoucher,
} from "../../apps/supabase/functionsClient";

/**
 * Central tool dispatcher that routes tool calls to their implementations
 * @param name - Tool name
 * @param args - Tool arguments (will be validated by the individual functions)
 * @returns Tool execution result as JSON string
 */
export async function callTool(name: string, args: any): Promise<string> {
  try {
    let result: any;

    switch (name) {
      case "create_voucher":
        result = await createVoucher(args);
        break;
      case "lookup_customer":
        result = await lookupCustomer(args);
        break;
      case "redeem_voucher":
        result = await redeemVoucher(args);
        break;
      case "void_voucher":
        result = await voidVoucher(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return JSON.stringify({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ success: false, error: errorMessage });
  }
}
