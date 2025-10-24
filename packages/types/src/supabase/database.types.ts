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
  concierge: {
    Tables: {
      presence: {
        Row: {
          id: string;
          traveler_id: string;
          group_id: string;
          itinerary_id: string | null;
          status: string;
          is_opted_in: boolean;
          visible: boolean;
          last_seen: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          traveler_id: string;
          group_id: string;
          itinerary_id?: string | null;
          status?: string;
          is_opted_in?: boolean;
          visible?: boolean;
          last_seen?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          traveler_id?: string;
          group_id?: string;
          itinerary_id?: string | null;
          status?: string;
          is_opted_in?: boolean;
          visible?: boolean;
          last_seen?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presence_traveler_id_fkey";
            columns: ["traveler_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presence_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presence_itinerary_id_fkey";
            columns: ["itinerary_id"];
            referencedRelation: "itineraries";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  group: {
    Tables: {
      live_slots: {
        Row: {
          escrow_id: string;
          group_id: string;
          itinerary_id: string | null;
          total_slots: number;
          filled_slots: number;
          available_slots: number;
          waitlist_slots: number;
          presence_opt_in: number;
          presence_visible: number;
          presence_online: number;
          visible: boolean;
          updated_at: string;
        };
        Insert: {
          escrow_id: string;
          group_id: string;
          itinerary_id?: string | null;
          total_slots?: number;
          filled_slots?: number;
          available_slots?: number;
          waitlist_slots?: number;
          presence_opt_in?: number;
          presence_visible?: number;
          presence_online?: number;
          visible?: boolean;
          updated_at?: string;
        };
        Update: {
          escrow_id?: string;
          group_id?: string;
          itinerary_id?: string | null;
          total_slots?: number;
          filled_slots?: number;
          available_slots?: number;
          waitlist_slots?: number;
          presence_opt_in?: number;
          presence_visible?: number;
          presence_online?: number;
          visible?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_slots_escrow_id_fkey";
            columns: ["escrow_id"];
            referencedRelation: "escrows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_slots_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_slots_itinerary_id_fkey";
            columns: ["itinerary_id"];
            referencedRelation: "itineraries";
            referencedColumns: ["id"];
          },
        ];
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
