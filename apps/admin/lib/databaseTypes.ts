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
  affiliate: {
    Tables: {
      partner: {
        Row: {
          id: string;
          slug: string;
          name: string;
          contact_email: string | null;
          signing_secret: string | null;
          active: boolean;
          metadata: unknown;
          created_at: string;
          updated_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          partner_id: string | null;
          partner_slug: string;
          partner_name: string | null;
          direction: string;
          event_type: string;
          request_id: string | null;
          signature_status: string;
          signature_error: string | null;
          signature_version: string | null;
          signature: string | null;
          metadata: unknown;
          headers: unknown;
          payload: unknown;
          raw_body: string | null;
          created_at: string;
        };
      };
    };
    Views: {
      events_view: {
        Row: {
          id: string;
          created_at: string;
          direction: string;
          event_type: string;
          request_id: string | null;
          partner_id: string | null;
          partner_slug: string;
          partner_name: string | null;
          signature_version: string | null;
          signature: string | null;
          signature_status: string;
          signature_error: string | null;
          metadata: unknown;
          headers: unknown;
          payload: unknown;
          raw_body: string | null;
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
