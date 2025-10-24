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
  audit: {
    Tables: {
      events: {
        Row: {
          id: number;
          who: string | null;
          what: string;
          payload: unknown;
          created_at: string | null;
        };
        Insert: {
          who?: string | null;
          what: string;
          payload?: unknown;
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
      v_supplier_onboarding_queue: {
        Row: {
          id: string;
          supplier_name: string;
          contact_email: string;
          onboarding_stage: string;
          status: string;
          priority: number;
          assigned_admin: string;
          hours_open: number;
        };
      };
      v_offline_coverage: {
        Row: {
          region: string;
          country_code: string;
          availability_percent: number;
          offline_suppliers: number;
          sample_size: number;
          health_label: string;
        };
      };
      v_analytics_event_counts: {
        Row: {
          event: string;
          captured_hour: string;
          total: number;
          unique_sessions: number;
          first_seen: string;
          last_seen: string;
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
