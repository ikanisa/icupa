export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  app: {
    Tables: {
      user_autonomy_prefs: {
        Row: {
          user_id: string;
          category: string;
          autonomy_level: string;
          composer_mode: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          category: string;
          autonomy_level: string;
          composer_mode?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          category?: string;
          autonomy_level?: string;
          composer_mode?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  sec: {
    Tables: {
      user_roles: {
        Row: {
          user_id: string;
          role: string;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          role: string;
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          role?: string;
          granted_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  storage: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
