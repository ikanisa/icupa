export type AdminDatabase = {
  sec: {
    Tables: {
      user_roles: {
        Row: {
          user_id: string;
          role: string;
          granted_at: string;
        };
      };
    };
  };
  ops: {
    Tables: {
      console_feature_flags: {
        Row: {
          key: string;
          description: string;
          enabled: boolean;
          updated_at: string;
        };
      };
      console_fixtures: {
        Row: {
          key: string;
          payload: unknown;
          updated_at: string;
        };
      };
      v_dr_snapshots: {
        Row: {
          id: string;
          label: string | null;
          object_path: string | null;
          tables: string[] | null;
          bytes: number | null;
          created_at: string | null;
          created_by: string | null;
          restore_checks: unknown;
        };
      };
    };
    Views: {
      v_finance_payouts_ext: {
        Row: {
          id: string;
          external_ref: string;
          provider: string | null;
          amount_cents: number | null;
          currency: string | null;
          recorded_at: string | null;
          reconciled: boolean | null;
          payout_id: string | null;
          internal_ref: string | null;
          internal_amount_cents: number | null;
          matched_at: string | null;
          metadata: unknown;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
    };
  };
};
