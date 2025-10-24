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
  };
};
