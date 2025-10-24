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
  };
  b2b: {
    Tables: {
      api_keys: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          key_prefix: string;
          key_hash: string;
          status: string;
          scopes: string[];
          metadata: Record<string, unknown>;
          created_by: string | null;
          created_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoked_reason: string | null;
          last_used_at: string | null;
          last_ip: string | null;
          usage_count: number;
        };
      };
    };
  };
  travel: {
    Tables: {
      intents: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          api_key_id: string | null;
          company_name: string;
          contact_name: string | null;
          email: string;
          phone: string | null;
          party_size: number | null;
          start_date: string | null;
          end_date: string | null;
          destinations: string[];
          budget_min_cents: number | null;
          budget_max_cents: number | null;
          notes: string | null;
          idempotency_key: string;
          raw_payload: Record<string, unknown>;
          status: string;
        };
      };
    };
  };
};
