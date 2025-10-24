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
  travel: {
    Tables: {
      price_watches: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          origin: string;
          destination: string;
          departure_date: string;
          return_date: string | null;
          currency: string;
          target_price_cents: number;
          contact: string | null;
          channel: string;
          status: string;
          metadata: Json;
          request_id: string | null;
          next_refresh_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          origin: string;
          destination: string;
          departure_date: string;
          return_date?: string | null;
          currency?: string;
          target_price_cents: number;
          contact?: string | null;
          channel?: string;
          status?: string;
          metadata?: Json;
          request_id?: string | null;
          next_refresh_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          origin?: string;
          destination?: string;
          departure_date?: string;
          return_date?: string | null;
          currency?: string;
          target_price_cents?: number;
          contact?: string | null;
          channel?: string;
          status?: string;
          metadata?: Json;
          request_id?: string | null;
          next_refresh_at?: string | null;
          notes?: string | null;
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
