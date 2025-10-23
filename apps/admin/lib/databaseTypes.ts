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
};
