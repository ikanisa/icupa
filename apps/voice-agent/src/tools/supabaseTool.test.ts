import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMemberBalance, redeemVoucher } from './supabaseTool';

// Mock Supabase
vi.mock('../supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: table === 'savings' 
          ? { balance: 1500, currency: 'RWF', updated_at: '2025-01-01T00:00:00Z' }
          : {
              code: 'TEST50',
              value: 5000,
              currency: 'RWF',
              redeemed_at: null,
              expires_at: null,
            },
        error: null,
      }),
    }),
  }),
}));

describe('Supabase Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMemberBalance', () => {
    it('returns member balance', async () => {
      const result = await getMemberBalance({ memberId: 'member_123' });

      expect(result).toEqual({
        success: true,
        memberId: 'member_123',
        balance: 1500,
        currency: 'RWF',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('throws error for missing memberId', async () => {
      await expect(getMemberBalance({})).rejects.toThrow();
    });

    it('throws error for invalid memberId type', async () => {
      await expect(getMemberBalance({ memberId: 123 })).rejects.toThrow();
    });
  });

  describe('redeemVoucher', () => {
    it('validates voucher code is required', async () => {
      await expect(redeemVoucher({})).rejects.toThrow();
    });

    it('validates voucher code is string', async () => {
      await expect(redeemVoucher({ code: 123 })).rejects.toThrow();
    });

    it('accepts optional memberId', async () => {
      const result = await redeemVoucher({ 
        code: 'TEST50', 
        memberId: 'member_123' 
      });

      expect(result).toBeDefined();
    });
  });
});
