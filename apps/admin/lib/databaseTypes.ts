export type AdminDatabase = {
  fin: {
    Tables: {
      cost_estimates: {
        Row: {
          id: string;
          month: string;
          category: "llm_tokens" | "storage" | "egress";
          label: string;
          estimated_cents: number;
          currency: string;
          confidence: "low" | "medium" | "high";
          usage_notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
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
};
