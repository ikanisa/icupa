export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      agent_action_queue: {
        Row: {
          action_type: string;
          agent_type: string;
          approved_at: string | null;
          approved_by: string | null;
          applied_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          location_id: string | null;
          notes: Json;
          payload: Json;
          status: string;
          tenant_id: string | null;
        };
        Insert: {
          action_type: string;
          agent_type: string;
          approved_at?: string | null;
          approved_by?: string | null;
          applied_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string | null;
          notes?: Json;
          payload: Json;
          status?: string;
          tenant_id?: string | null;
        };
        Update: {
          action_type?: string;
          agent_type?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          applied_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string | null;
          notes?: Json;
          payload?: Json;
          status?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_action_queue_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_action_queue_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_config_audit_events: {
        Row: {
          action: string;
          after_state: Json;
          agent_type: string;
          before_state: Json | null;
          changed_by: string | null;
          config_id: string;
          created_at: string;
          id: string;
          tenant_id: string | null;
        };
        Insert: {
          action: string;
          after_state: Json;
          agent_type: string;
          before_state?: Json | null;
          changed_by?: string | null;
          config_id: string;
          created_at?: string;
          id?: string;
          tenant_id?: string | null;
        };
        Update: {
          action?: string;
          after_state?: Json;
          agent_type?: string;
          before_state?: Json | null;
          changed_by?: string | null;
          config_id?: string;
          created_at?: string;
          id?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_config_audit_events_config_id_fkey";
            columns: ["config_id"];
            isOneToOne: false;
            referencedRelation: "agent_runtime_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_config_audit_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_events: {
        Row: {
          agent_type: string;
          cost_usd: number | null;
          created_at: string;
          id: string;
          input: Json | null;
          latency_ms: number | null;
          location_id: string | null;
          output: Json | null;
          payload: Json;
          session_id: string | null;
          table_session_id: string | null;
          tenant_id: string | null;
          tools_used: string[] | null;
        };
        Insert: {
          agent_type: string;
          cost_usd?: number | null;
          created_at?: string;
          id?: string;
          input?: Json | null;
          latency_ms?: number | null;
          location_id?: string | null;
          output?: Json | null;
          payload?: Json;
          session_id?: string | null;
          table_session_id?: string | null;
          tenant_id?: string | null;
          tools_used?: string[] | null;
        };
        Update: {
          agent_type?: string;
          cost_usd?: number | null;
          created_at?: string;
          id?: string;
          input?: Json | null;
          latency_ms?: number | null;
          location_id?: string | null;
          output?: Json | null;
          payload?: Json;
          session_id?: string | null;
          table_session_id?: string | null;
          tenant_id?: string | null;
          tools_used?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_events_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_events_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_runtime_configs: {
        Row: {
          agent_type: string;
          autonomy_level: Database["public"]["Enums"]["autonomy_level_t"];
          daily_budget_usd: number;
          enabled: boolean;
          experiment_flag: string | null;
          id: string;
          instructions: string;
          metadata: Json;
          retrieval_ttl_minutes: number;
          session_budget_usd: number;
          sync_pending: boolean;
          tenant_id: string | null;
          tool_allowlist: string[];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          agent_type: string;
          autonomy_level?: Database["public"]["Enums"]["autonomy_level_t"];
          daily_budget_usd?: number;
          enabled?: boolean;
          experiment_flag?: string | null;
          id?: string;
          instructions?: string;
          metadata?: Json;
          retrieval_ttl_minutes?: number;
          session_budget_usd?: number;
          sync_pending?: boolean;
          tenant_id?: string | null;
          tool_allowlist?: string[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          agent_type?: string;
          autonomy_level?: Database["public"]["Enums"]["autonomy_level_t"];
          daily_budget_usd?: number;
          enabled?: boolean;
          experiment_flag?: string | null;
          id?: string;
          instructions?: string;
          metadata?: Json;
          retrieval_ttl_minutes?: number;
          session_budget_usd?: number;
          sync_pending?: boolean;
          tenant_id?: string | null;
          tool_allowlist?: string[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_runtime_configs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_sessions: {
        Row: {
          agent_type: string;
          context: Json;
          created_at: string;
          id: string;
          location_id: string | null;
          table_session_id: string | null;
          tenant_id: string | null;
          user_id: string | null;
        };
        Insert: {
          agent_type: string;
          context?: Json;
          created_at?: string;
          id?: string;
          location_id?: string | null;
          table_session_id?: string | null;
          tenant_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          agent_type?: string;
          context?: Json;
          created_at?: string;
          id?: string;
          location_id?: string | null;
          table_session_id?: string | null;
          tenant_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_sessions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_sessions_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_sessions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          menu_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          menu_id: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          menu_id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categories_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "menus";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_tasks: {
        Row: {
          category: string;
          created_at: string;
          details: Json;
          due_at: string | null;
          id: string;
          region: Database["public"]["Enums"]["region_t"];
          resolved_at: string | null;
          resolved_by: string | null;
          severity: Database["public"]["Enums"]["compliance_severity_t"];
          status: Database["public"]["Enums"]["compliance_status_t"];
          tenant_id: string | null;
          title: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          details?: Json;
          due_at?: string | null;
          id?: string;
          region: Database["public"]["Enums"]["region_t"];
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database["public"]["Enums"]["compliance_severity_t"];
          status?: Database["public"]["Enums"]["compliance_status_t"];
          tenant_id?: string | null;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          details?: Json;
          due_at?: string | null;
          id?: string;
          region?: Database["public"]["Enums"]["region_t"];
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database["public"]["Enums"]["compliance_severity_t"];
          status?: Database["public"]["Enums"]["compliance_status_t"];
          tenant_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_tasks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          id: number;
          location_id: string | null;
          payload: Json;
          table_session_id: string | null;
          tenant_id: string | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          location_id?: string | null;
          payload?: Json;
          table_session_id?: string | null;
          tenant_id?: string | null;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          location_id?: string | null;
          payload?: Json;
          table_session_id?: string | null;
          tenant_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          auto_86: boolean;
          auto_86_level: string;
          display_name: string;
          id: string;
          lead_time_days: number | null;
          location_id: string;
          par_level: number;
          quantity: number;
          reorder_threshold: number;
          sku: string;
          tenant_id: string;
          track: boolean;
          updated_at: string;
        };
        Insert: {
          auto_86?: boolean;
          auto_86_level?: string;
          display_name: string;
          id?: string;
          lead_time_days?: number | null;
          location_id: string;
          par_level?: number;
          quantity?: number;
          reorder_threshold?: number;
          sku: string;
          tenant_id: string;
          track?: boolean;
          updated_at?: string;
        };
        Update: {
          auto_86?: boolean;
          auto_86_level?: string;
          display_name?: string;
          id?: string;
          lead_time_days?: number | null;
          location_id?: string;
          par_level?: number;
          quantity?: number;
          reorder_threshold?: number;
          sku?: string;
          tenant_id?: string;
          track?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      item_ingredients: {
        Row: {
          inventory_id: string;
          item_id: string;
          quantity: number;
        };
        Insert: {
          inventory_id: string;
          item_id: string;
          quantity: number;
        };
        Update: {
          inventory_id?: string;
          item_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "item_ingredients_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_ingredients_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          allergens: string[];
          category_id: string | null;
          created_at: string;
          currency: string;
          description: string | null;
          embedding: string | null;
          id: string;
          is_alcohol: boolean;
          is_available: boolean;
          location_id: string;
          media_url: string | null;
          menu_id: string | null;
          name: string;
          price_cents: number;
          tags: string[];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          allergens?: string[];
          category_id?: string | null;
          created_at?: string;
          currency: string;
          description?: string | null;
          embedding?: string | null;
          id?: string;
          is_alcohol?: boolean;
          is_available?: boolean;
          location_id: string;
          media_url?: string | null;
          menu_id?: string | null;
          name: string;
          price_cents: number;
          tags?: string[];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          allergens?: string[];
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          embedding?: string | null;
          id?: string;
          is_alcohol?: boolean;
          is_available?: boolean;
          location_id?: string;
          media_url?: string | null;
          menu_id?: string | null;
          name?: string;
          price_cents?: number;
          tags?: string[];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "menus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          name: string;
          region: Database["public"]["Enums"]["region_t"];
          settings: Json;
          tenant_id: string;
          timezone: string;
          vat_rate: number | null;
        };
        Insert: {
          created_at?: string;
          currency: string;
          id?: string;
          name: string;
          region: Database["public"]["Enums"]["region_t"];
          settings?: Json;
          tenant_id: string;
          timezone: string;
          vat_rate?: number | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          name?: string;
          region?: Database["public"]["Enums"]["region_t"];
          settings?: Json;
          tenant_id?: string;
          timezone?: string;
          vat_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_copy_suggestions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          id: string;
          item_id: string;
          locale: string;
          metadata: Json;
          rationale: string | null;
          rejected_reason: string | null;
          status: Database["public"]["Enums"]["copy_review_status_t"];
          suggested_description: string;
          suggested_name: string;
          tone: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          item_id: string;
          locale: string;
          metadata?: Json;
          rationale?: string | null;
          rejected_reason?: string | null;
          status?: Database["public"]["Enums"]["copy_review_status_t"];
          suggested_description: string;
          suggested_name: string;
          tone?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string;
          locale?: string;
          metadata?: Json;
          rationale?: string | null;
          rejected_reason?: string | null;
          status?: Database["public"]["Enums"]["copy_review_status_t"];
          suggested_description?: string;
          suggested_name?: string;
          tone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_copy_suggestions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      menus: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          location_id: string;
          name: string;
          published_at: string | null;
          tenant_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          location_id: string;
          name: string;
          published_at?: string | null;
          tenant_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          location_id?: string;
          name?: string;
          published_at?: string | null;
          tenant_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menus_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menus_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_prefs: {
        Row: {
          allergens: string[];
          created_at: string;
          dislikes: string[];
          language: string | null;
          user_id: string;
        };
        Insert: {
          allergens?: string[];
          created_at?: string;
          dislikes?: string[];
          language?: string | null;
          user_id: string;
        };
        Update: {
          allergens?: string[];
          created_at?: string;
          dislikes?: string[];
          language?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      dsr_requests: {
        Row: {
          created_at: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          rationale: string | null;
          request_type: string;
          requested_by: string | null;
          status: string;
          subject_user_id: string | null;
          tenant_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          rationale?: string | null;
          request_type: string;
          requested_by?: string | null;
          status?: string;
          subject_user_id?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          rationale?: string | null;
          request_type?: string;
          requested_by?: string | null;
          status?: string;
          subject_user_id?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dsr_requests_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_ingestions: {
        Row: {
          created_at: string;
          currency: string | null;
          errors: Json;
          file_mime: string;
          id: string;
          items_count: number;
          location_id: string;
          metadata: Json;
          original_filename: string | null;
          pages_processed: number;
          raw_text: string | null;
          status: Database["public"]["Enums"]["menu_ingestion_status_t"];
          storage_path: string;
          structured_json: Json | null;
          tenant_id: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string | null;
          errors?: Json;
          file_mime: string;
          id?: string;
          items_count?: number;
          location_id: string;
          metadata?: Json;
          original_filename?: string | null;
          pages_processed?: number;
          raw_text?: string | null;
          status?: Database["public"]["Enums"]["menu_ingestion_status_t"];
          storage_path: string;
          structured_json?: Json | null;
          tenant_id: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          errors?: Json;
          file_mime?: string;
          id?: string;
          items_count?: number;
          location_id?: string;
          metadata?: Json;
          original_filename?: string | null;
          pages_processed?: number;
          raw_text?: string | null;
          status?: Database["public"]["Enums"]["menu_ingestion_status_t"];
          storage_path?: string;
          structured_json?: Json | null;
          tenant_id?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_ingestions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_ingestions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items_staging: {
        Row: {
          allergens: string[];
          category_name: string | null;
          confidence: number | null;
          created_at: string;
          currency: string | null;
          description: string | null;
          flags: Json;
          id: string;
          ingestion_id: string;
          is_alcohol: boolean;
          media_url: string | null;
          name: string;
          price_cents: number | null;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          allergens?: string[];
          category_name?: string | null;
          confidence?: number | null;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          flags?: Json;
          id?: string;
          ingestion_id: string;
          is_alcohol?: boolean;
          media_url?: string | null;
          name: string;
          price_cents?: number | null;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          allergens?: string[];
          category_name?: string | null;
          confidence?: number | null;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          flags?: Json;
          id?: string;
          ingestion_id?: string;
          is_alcohol?: boolean;
          media_url?: string | null;
          name?: string;
          price_cents?: number | null;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_staging_ingestion_id_fkey";
            columns: ["ingestion_id"];
            isOneToOne: false;
            referencedRelation: "menu_ingestions";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_profiles: {
        Row: {
          created_at: string;
          location_gps: Json | null;
          momo_code: string | null;
          onboarding_step: string;
          role: Database["public"]["Enums"]["role_t"];
          tenant_id: string;
          updated_at: string;
          user_id: string;
          whatsapp_number_e164: string | null;
          whatsapp_verified_at: string | null;
        };
        Insert: {
          created_at?: string;
          location_gps?: Json | null;
          momo_code?: string | null;
          onboarding_step?: string;
          role?: Database["public"]["Enums"]["role_t"];
          tenant_id: string;
          updated_at?: string;
          user_id: string;
          whatsapp_number_e164?: string | null;
          whatsapp_verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          location_gps?: Json | null;
          momo_code?: string | null;
          onboarding_step?: string;
          role?: Database["public"]["Enums"]["role_t"];
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
          whatsapp_number_e164?: string | null;
          whatsapp_verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      modifier_groups: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          max_selections: number;
          min_selections: number;
          name: string;
          required: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          max_selections?: number;
          min_selections?: number;
          name: string;
          required?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          max_selections?: number;
          min_selections?: number;
          name?: string;
          required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "modifier_groups_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      modifiers: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          name: string;
          price_delta_cents: number;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          name: string;
          price_delta_cents?: number;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          name?: string;
          price_delta_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_seen_at: string;
          locale: string | null;
          location_id: string | null;
          p256dh: string;
          profile_id: string | null;
          subscription: Json;
          table_session_id: string | null;
          tenant_id: string | null;
          updated_at: string;
          user_agent: string | null;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          location_id?: string | null;
          p256dh: string;
          profile_id?: string | null;
          subscription: Json;
          table_session_id?: string | null;
          tenant_id?: string | null;
          updated_at?: string;
          user_agent?: string | null;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          location_id?: string | null;
          p256dh?: string;
          profile_id?: string | null;
          subscription?: Json;
          table_session_id?: string | null;
          tenant_id?: string | null;
          updated_at?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_subscriptions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_subscriptions_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_subscriptions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      offline_sync_events: {
        Row: {
          id: string;
          tenant_id: string | null;
          location_id: string | null;
          table_session_id: string;
          replayed_count: number;
          first_enqueued_at: string | null;
          replay_started_at: string | null;
          replay_completed_at: string | null;
          queued_duration_ms: number | null;
          replay_latency_ms: number | null;
          had_error: boolean;
          metadata: Json | null;
          batch_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          location_id?: string | null;
          table_session_id: string;
          replayed_count: number;
          first_enqueued_at?: string | null;
          replay_started_at?: string | null;
          replay_completed_at?: string | null;
          queued_duration_ms?: number | null;
          replay_latency_ms?: number | null;
          had_error?: boolean;
          metadata?: Json | null;
          batch_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          location_id?: string | null;
          table_session_id?: string;
          replayed_count?: number;
          first_enqueued_at?: string | null;
          replay_started_at?: string | null;
          replay_completed_at?: string | null;
          queued_duration_ms?: number | null;
          replay_latency_ms?: number | null;
          had_error?: boolean;
          metadata?: Json | null;
          batch_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "offline_sync_events_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offline_sync_events_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offline_sync_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_mods: {
        Row: {
          id: string;
          modifier_id: string;
          order_item_id: string;
          price_delta_cents: number;
        };
        Insert: {
          id?: string;
          modifier_id: string;
          order_item_id: string;
          price_delta_cents: number;
        };
        Update: {
          id?: string;
          modifier_id?: string;
          order_item_id?: string;
          price_delta_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_mods_modifier_id_fkey";
            columns: ["modifier_id"];
            isOneToOne: false;
            referencedRelation: "modifiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_mods_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          notes: string | null;
          order_id: string;
          quantity: number;
          unit_price_cents: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          notes?: string | null;
          order_id: string;
          quantity: number;
          unit_price_cents: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          notes?: string | null;
          order_id?: string;
          quantity?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          channel: string;
          created_at: string;
          currency: string;
          customer_id: string | null;
          id: string;
          location_id: string;
          service_cents: number;
          status: Database["public"]["Enums"]["order_status_t"];
          subtotal_cents: number;
          table_id: string | null;
          table_session_id: string | null;
          tax_cents: number;
          tenant_id: string;
          total_cents: number;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          currency: string;
          customer_id?: string | null;
          id?: string;
          location_id: string;
          service_cents?: number;
          status?: Database["public"]["Enums"]["order_status_t"];
          subtotal_cents?: number;
          table_id?: string | null;
          table_session_id?: string | null;
          tax_cents?: number;
          tenant_id: string;
          total_cents?: number;
        };
        Update: {
          channel?: string;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          id?: string;
          location_id?: string;
          service_cents?: number;
          status?: Database["public"]["Enums"]["order_status_t"];
          subtotal_cents?: number;
          table_id?: string | null;
          table_session_id?: string | null;
          tax_cents?: number;
          tenant_id?: string;
          total_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          method: Database["public"]["Enums"]["payment_method_t"];
          order_id: string;
          provider_ref: string | null;
          status: Database["public"]["Enums"]["payment_status_t"];
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency: string;
          failure_reason?: string | null;
          id?: string;
          method: Database["public"]["Enums"]["payment_method_t"];
          order_id: string;
          provider_ref?: string | null;
          status?: Database["public"]["Enums"]["payment_status_t"];
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method_t"];
          order_id?: string;
          provider_ref?: string | null;
          status?: Database["public"]["Enums"]["payment_status_t"];
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_refunds: {
        Row: {
          amount_cents: number;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          currency: string;
          id: string;
          location_id: string | null;
          metadata: Json;
          payment_id: string;
          processed_at: string | null;
          processed_by: string | null;
          reason: string | null;
          requested_by: string | null;
          status: string;
          tenant_id: string | null;
        };
        Insert: {
          amount_cents: number;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          currency: string;
          id?: string;
          location_id?: string | null;
          metadata?: Json;
          payment_id: string;
          processed_at?: string | null;
          processed_by?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          status?: string;
          tenant_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          location_id?: string | null;
          metadata?: Json;
          payment_id?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          status?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_refunds_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_refunds_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_reconciliation_runs: {
        Row: {
          completed_at: string | null;
          coverage_end: string;
          coverage_start: string;
          created_at: string;
          discrepancies: Json;
          id: string;
          notes: string | null;
          pending_payments: number;
          status: string;
          total_captured_cents: number;
          total_failed: number;
        };
        Insert: {
          completed_at?: string | null;
          coverage_end: string;
          coverage_start: string;
          created_at?: string;
          discrepancies?: Json;
          id?: string;
          notes?: string | null;
          pending_payments?: number;
          status?: string;
          total_captured_cents?: number;
          total_failed?: number;
        };
        Update: {
          completed_at?: string | null;
          coverage_end?: string;
          coverage_start?: string;
          created_at?: string;
          discrepancies?: Json;
          id?: string;
          notes?: string | null;
          pending_payments?: number;
          status?: string;
          total_captured_cents?: number;
          total_failed?: number;
        };
        Relationships: [];
      };
      payment_webhook_events: {
        Row: {
          event_id: string;
          id: string;
          last_status: string;
          payload: Json;
          processed_at: string;
          provider: string;
          signature: string | null;
        };
        Insert: {
          event_id: string;
          id?: string;
          last_status?: string;
          payload?: Json;
          processed_at?: string;
          provider: string;
          signature?: string | null;
        };
        Update: {
          event_id?: string;
          id?: string;
          last_status?: string;
          payload?: Json;
          processed_at?: string;
          provider?: string;
          signature?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          default_locale: string | null;
          display_name: string | null;
          preferences: Json;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          default_locale?: string | null;
          display_name?: string | null;
          preferences?: Json;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          default_locale?: string | null;
          display_name?: string | null;
          preferences?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      promo_audit_events: {
        Row: {
          action: string;
          campaign_id: string;
          created_at: string;
          created_by: string | null;
          detail: Json;
          id: string;
        };
        Insert: {
          action: string;
          campaign_id: string;
          created_at?: string;
          created_by?: string | null;
          detail?: Json;
          id?: string;
        };
        Update: {
          action?: string;
          campaign_id?: string;
          created_at?: string;
          created_by?: string | null;
          detail?: Json;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_audit_events_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "promo_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      promo_campaigns: {
        Row: {
          budget_cap_cents: number;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          epsilon: number;
          fairness_constraints: Json;
          frequency_cap: number;
          id: string;
          location_id: string | null;
          name: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          spent_cents: number;
          starts_at: string | null;
          status: Database["public"]["Enums"]["promo_status_t"];
          tenant_id: string;
        };
        Insert: {
          budget_cap_cents?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          epsilon?: number;
          fairness_constraints?: Json;
          frequency_cap?: number;
          id?: string;
          location_id?: string | null;
          name: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          spent_cents?: number;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["promo_status_t"];
          tenant_id: string;
        };
        Update: {
          budget_cap_cents?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          epsilon?: number;
          fairness_constraints?: Json;
          frequency_cap?: number;
          id?: string;
          location_id?: string | null;
          name?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          spent_cents?: number;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["promo_status_t"];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_campaigns_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promo_campaigns_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      receipts: {
        Row: {
          created_at: string;
          fiscal_id: string | null;
          id: string;
          order_id: string;
          payload: Json | null;
          region: Database["public"]["Enums"]["region_t"];
          url: string | null;
        };
        Insert: {
          created_at?: string;
          fiscal_id?: string | null;
          id?: string;
          order_id: string;
          payload?: Json | null;
          region: Database["public"]["Enums"]["region_t"];
          url?: string | null;
        };
        Update: {
          created_at?: string;
          fiscal_id?: string | null;
          id?: string;
          order_id?: string;
          payload?: Json | null;
          region?: Database["public"]["Enums"]["region_t"];
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_impressions: {
        Row: {
          accepted: boolean | null;
          id: string;
          item_id: string | null;
          location_id: string | null;
          rationale: string | null;
          session_id: string | null;
          shown_at: string;
          tenant_id: string | null;
        };
        Insert: {
          accepted?: boolean | null;
          id?: string;
          item_id?: string | null;
          location_id?: string | null;
          rationale?: string | null;
          session_id?: string | null;
          shown_at?: string;
          tenant_id?: string | null;
        };
        Update: {
          accepted?: boolean | null;
          id?: string;
          item_id?: string | null;
          location_id?: string | null;
          rationale?: string | null;
          session_id?: string | null;
          shown_at?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_impressions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_impressions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_impressions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "agent_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_impressions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduler_config: {
        Row: {
          description: string | null;
          key: string;
          value: string;
        };
        Insert: {
          description?: string | null;
          key: string;
          value: string;
        };
        Update: {
          description?: string | null;
          key?: string;
          value?: string;
        };
        Relationships: [];
      };
      table_sessions: {
        Row: {
          created_at: string;
          device_fingerprint: string | null;
          expires_at: string;
          id: string;
          issued_for_ip: unknown | null;
          table_id: string;
        };
        Insert: {
          created_at?: string;
          device_fingerprint?: string | null;
          expires_at: string;
          id?: string;
          issued_for_ip?: unknown | null;
          table_id: string;
        };
        Update: {
          created_at?: string;
          device_fingerprint?: string | null;
          expires_at?: string;
          id?: string;
          issued_for_ip?: unknown | null;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_sessions_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
        ];
      };
      table_state_events: {
        Row: {
          changed_by: string | null;
          created_at: string;
          id: string;
          next_state: Database["public"]["Enums"]["table_state_t"];
          notes: string | null;
          previous_state: Database["public"]["Enums"]["table_state_t"] | null;
          table_id: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          next_state: Database["public"]["Enums"]["table_state_t"];
          notes?: string | null;
          previous_state?: Database["public"]["Enums"]["table_state_t"] | null;
          table_id: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          next_state?: Database["public"]["Enums"]["table_state_t"];
          notes?: string | null;
          previous_state?: Database["public"]["Enums"]["table_state_t"] | null;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_state_events_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
        ];
      };
      tables: {
        Row: {
          code: string;
          id: string;
          layout: Json;
          location_id: string;
          qrtoken: string;
          seats: number;
          state: Database["public"]["Enums"]["table_state_t"];
        };
        Insert: {
          code: string;
          id?: string;
          layout?: Json;
          location_id: string;
          qrtoken: string;
          seats?: number;
          state?: Database["public"]["Enums"]["table_state_t"];
        };
        Update: {
          code?: string;
          id?: string;
          layout?: Json;
          location_id?: string;
          qrtoken?: string;
          seats?: number;
          state?: Database["public"]["Enums"]["table_state_t"];
        };
        Relationships: [
          {
            foreignKeyName: "tables_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_kpi_snapshots: {
        Row: {
          ai_acceptance_rate: number;
          aov_cents: number;
          attach_rate: number;
          captured_at: string;
          gmv_cents: number;
          id: string;
          prep_sla_p95_minutes: number;
          safety_blocks: number;
          tenant_id: string;
          time_window: string;
        };
        Insert: {
          ai_acceptance_rate?: number;
          aov_cents?: number;
          attach_rate?: number;
          captured_at?: string;
          gmv_cents?: number;
          id?: string;
          prep_sla_p95_minutes?: number;
          safety_blocks?: number;
          tenant_id: string;
          time_window?: string;
        };
        Update: {
          ai_acceptance_rate?: number;
          aov_cents?: number;
          attach_rate?: number;
          captured_at?: string;
          gmv_cents?: number;
          id?: string;
          prep_sla_p95_minutes?: number;
          safety_blocks?: number;
          tenant_id?: string;
          time_window?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_kpi_snapshots_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          region: Database["public"]["Enums"]["region_t"];
          settings: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          region: Database["public"]["Enums"]["region_t"];
          settings?: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          region?: Database["public"]["Enums"]["region_t"];
          settings?: Json;
        };
        Relationships: [];
      };
      voice_sessions: {
        Row: {
          client_token: string;
          created_at: string;
          expires_at: string;
          id: string;
          location_id: string | null;
          table_session_id: string;
          tenant_id: string | null;
        };
        Insert: {
          client_token: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          location_id?: string | null;
          table_session_id: string;
          tenant_id?: string | null;
        };
        Update: {
          client_token?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          location_id?: string | null;
          table_session_id?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "voice_sessions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_sessions_table_session_id_fkey";
            columns: ["table_session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_sessions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_otps: {
        Row: {
          attempts: number;
          created_at: string;
          expires_at: string;
          id: string;
          phone_e164: string;
          purpose: string;
          otp_hash: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          expires_at: string;
          id?: string;
          phone_e164: string;
          purpose?: string;
          otp_hash: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          expires_at?: string;
          id?: string;
          phone_e164?: string;
          purpose?: string;
          otp_hash?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["role_t"];
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["role_t"];
          tenant_id: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["role_t"];
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown };
        Returns: unknown;
      };
      current_table_session_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      delete_fiscalization_job: {
        Args: { msg_id: number };
        Returns: undefined;
      };
      dequeue_fiscalization_job: {
        Args: { visibility_timeout_seconds?: number };
        Returns: {
          enqueued_at: string;
          msg_id: number;
          order_id: string;
          payment_id: string;
        }[];
      };
      enqueue_fiscalization_job: {
        Args: { order_uuid: string; payment_uuid: string };
        Returns: number;
      };
      gtrgm_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gtrgm_decompress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gtrgm_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gtrgm_options: {
        Args: { "": unknown };
        Returns: undefined;
      };
      gtrgm_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      halfvec_avg: {
        Args: { "": number[] };
        Returns: unknown;
      };
      halfvec_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      halfvec_send: {
        Args: { "": unknown };
        Returns: string;
      };
      halfvec_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
      hnsw_bit_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      hnsw_halfvec_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      hnsw_sparsevec_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      hnswhandler: {
        Args: { "": unknown };
        Returns: unknown;
      };
      increment_promo_spend: {
        Args: { campaign_id: string; delta_cents: number };
        Returns: {
          budget_cap_cents: number;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          epsilon: number;
          fairness_constraints: Json;
          frequency_cap: number;
          id: string;
          location_id: string | null;
          name: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          spent_cents: number;
          starts_at: string | null;
          status: Database["public"]["Enums"]["promo_status_t"];
          tenant_id: string;
        };
      };
      invoke_menu_embedding_refresh: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      is_staff_for_tenant: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["role_t"][];
          target_tenant: string;
        };
        Returns: boolean;
      };
      ivfflat_bit_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      ivfflat_halfvec_support: {
        Args: { "": unknown };
        Returns: unknown;
      };
      ivfflathandler: {
        Args: { "": unknown };
        Returns: unknown;
      };
      l2_norm: {
        Args: { "": unknown } | { "": unknown };
        Returns: number;
      };
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown };
        Returns: string;
      };
      set_limit: {
        Args: { "": number };
        Returns: number;
      };
      show_limit: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      show_trgm: {
        Args: { "": string };
        Returns: string[];
      };
      sparsevec_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      sparsevec_send: {
        Args: { "": unknown };
        Returns: string;
      };
      sparsevec_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
      unit_embedding: {
        Args: { index_position: number };
        Returns: string;
      };
      vector_avg: {
        Args: { "": number[] };
        Returns: string;
      };
      vector_dims: {
        Args: { "": string } | { "": unknown };
        Returns: number;
      };
      vector_norm: {
        Args: { "": string };
        Returns: number;
      };
      vector_out: {
        Args: { "": string };
        Returns: unknown;
      };
      vector_send: {
        Args: { "": string };
        Returns: string;
      };
      vector_typmod_in: {
        Args: { "": unknown[] };
        Returns: number;
      };
    };
    Enums: {
      autonomy_level_t: "L0" | "L1" | "L2" | "L3";
      compliance_severity_t: "low" | "medium" | "high" | "critical";
      compliance_status_t: "pending" | "in_progress" | "blocked" | "resolved";
      copy_review_status_t: "pending" | "approved" | "rejected";
      menu_ingestion_status_t:
        | "uploaded"
        | "processing"
        | "awaiting_review"
        | "failed"
        | "published";
      order_status_t:
        | "draft"
        | "submitted"
        | "in_kitchen"
        | "ready"
        | "served"
        | "settled"
        | "voided";
      payment_method_t:
        | "mtn_momo"
        | "airtel_money"
        | "stripe"
        | "adyen"
        | "cash"
        | "card_on_prem";
      payment_status_t:
        | "pending"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded";
      promo_status_t:
        | "draft"
        | "pending_review"
        | "approved"
        | "active"
        | "paused"
        | "archived";
      region_t: "RW" | "EU";
      role_t:
        | "diner"
        | "owner"
        | "manager"
        | "cashier"
        | "server"
        | "chef"
        | "kds"
        | "auditor"
        | "support"
        | "admin";
      table_state_t:
        | "vacant"
        | "ordering"
        | "in_kitchen"
        | "served"
        | "bill"
        | "cleaning";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      autonomy_level_t: ["L0", "L1", "L2", "L3"],
      compliance_severity_t: ["low", "medium", "high", "critical"],
      compliance_status_t: ["pending", "in_progress", "blocked", "resolved"],
      copy_review_status_t: ["pending", "approved", "rejected"],
      order_status_t: [
        "draft",
        "submitted",
        "in_kitchen",
        "ready",
        "served",
        "settled",
        "voided",
      ],
      payment_method_t: [
        "mtn_momo",
        "airtel_money",
        "stripe",
        "adyen",
        "cash",
        "card_on_prem",
      ],
      payment_status_t: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
      ],
      promo_status_t: [
        "draft",
        "pending_review",
        "approved",
        "active",
        "paused",
        "archived",
      ],
      region_t: ["RW", "EU"],
      role_t: [
        "diner",
        "owner",
        "manager",
        "cashier",
        "server",
        "chef",
        "kds",
        "auditor",
        "support",
        "admin",
      ],
      table_state_t: [
        "vacant",
        "ordering",
        "in_kitchen",
        "served",
        "bill",
        "cleaning",
      ],
    },
  },
} as const;
