import { z } from 'zod';
import { getSupabase } from '../supabase.js';
import { log, logError } from '../utils.js';

// Input validation schemas
const GetMemberBalanceSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
});

const RedeemVoucherSchema = z.object({
  code: z.string().min(1, 'Voucher code is required'),
  memberId: z.string().optional(),
});

/**
 * Get member balance from Supabase
 * 
 * @param args - { memberId: string }
 * @returns Member balance information
 */
export async function getMemberBalance(args: Record<string, unknown>): Promise<unknown> {
  const validated = GetMemberBalanceSchema.parse(args);
  const { memberId } = validated;

  log('Getting member balance', { memberId });

  try {
    const supabase = getSupabase();
    
    // Query the savings table for member balance
    const { data, error } = await supabase
      .from('savings')
      .select('balance, currency, updated_at')
      .eq('member_id', memberId)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      return {
        success: false,
        error: 'Member not found',
      };
    }

    return {
      success: true,
      memberId,
      balance: data.balance,
      currency: data.currency,
      updatedAt: data.updated_at,
    };

  } catch (error) {
    logError('Error getting member balance', error, { memberId });
    
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors[0].message}`);
    }
    
    throw error;
  }
}

/**
 * Redeem a voucher code
 * 
 * @param args - { code: string, memberId?: string }
 * @returns Voucher redemption result
 */
export async function redeemVoucher(args: Record<string, unknown>): Promise<unknown> {
  const validated = RedeemVoucherSchema.parse(args);
  const { code, memberId } = validated;

  log('Redeeming voucher', { code, memberId });

  try {
    const supabase = getSupabase();
    
    // First, check if voucher exists and is valid
    const { data: voucher, error: fetchError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', code)
      .single();

    if (fetchError || !voucher) {
      return {
        success: false,
        error: 'Voucher not found',
      };
    }

    // Check if already redeemed
    if (voucher.redeemed_at) {
      return {
        success: false,
        error: 'Voucher already redeemed',
        redeemedAt: voucher.redeemed_at,
      };
    }

    // Check if expired
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return {
        success: false,
        error: 'Voucher expired',
        expiresAt: voucher.expires_at,
      };
    }

    // Redeem the voucher
    const { data: updated, error: updateError } = await supabase
      .from('vouchers')
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by: memberId || null,
      })
      .eq('code', code)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to redeem voucher: ${updateError.message}`);
    }

    return {
      success: true,
      code,
      value: voucher.value,
      currency: voucher.currency,
      redeemedAt: updated.redeemed_at,
    };

  } catch (error) {
    logError('Error redeeming voucher', error, { code, memberId });
    
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors[0].message}`);
    }
    
    throw error;
  }
}
