export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_recovery_log: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          new_email: string | null
          old_email: string | null
          outcome: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          new_email?: string | null
          old_email?: string | null
          outcome: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          new_email?: string | null
          old_email?: string | null
          outcome?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_recovery_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          bell_cleared_at: string | null
          company_id: string
          created_at: string | null
          id: string
          invoice_id: string | null
          is_read: boolean | null
          message: string | null
          order_id: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Insert: {
          alert_type: string
          bell_cleared_at?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          is_read?: boolean | null
          message?: string | null
          order_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Update: {
          alert_type?: string
          bell_cleared_at?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          is_read?: boolean | null
          message?: string | null
          order_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_events: {
        Row: {
          company_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          session_id: string | null
          tool_name: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          tool_name?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          tool_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_sessions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_active_at: string
          retention_until: string | null
          title: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_active_at?: string
          retention_until?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_active_at?: string
          retention_until?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_token_usage: {
        Row: {
          company_id: string
          id: string
          month_key: string
          total_tokens: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          month_key?: string
          total_tokens?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          month_key?: string
          total_tokens?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_token_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_workflow_progress: {
        Row: {
          company_id: string
          current_step: string | null
          current_workflow: string | null
          id: string
          updated_at: string
          user_id: string
          workflows_completed: string[]
        }
        Insert: {
          company_id: string
          current_step?: string | null
          current_workflow?: string | null
          id?: string
          updated_at?: string
          user_id: string
          workflows_completed?: string[]
        }
        Update: {
          company_id?: string
          current_step?: string | null
          current_workflow?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          workflows_completed?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assistant_workflow_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_submissions: {
        Row: {
          answers: Json
          created_at: string | null
          email: string
          id: string
          insights_generated_at: string | null
          paid: boolean | null
          paid_insights: Json | null
          stripe_session_id: string | null
        }
        Insert: {
          answers: Json
          created_at?: string | null
          email: string
          id?: string
          insights_generated_at?: string | null
          paid?: boolean | null
          paid_insights?: Json | null
          stripe_session_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string | null
          email?: string
          id?: string
          insights_generated_at?: string | null
          paid?: boolean | null
          paid_insights?: Json | null
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      bulk_operations_log: {
        Row: {
          actual_count: number
          company_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          operation: string
          outcome: string
          requested_count: number
          skipped_count: number
          target_ids: Json
          user_id: string
        }
        Insert: {
          actual_count?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          operation: string
          outcome?: string
          requested_count: number
          skipped_count?: number
          target_ids?: Json
          user_id: string
        }
        Update: {
          actual_count?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          operation?: string
          outcome?: string
          requested_count?: number
          skipped_count?: number
          target_ids?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_operations_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_maps: {
        Row: {
          catalog_id: string
          column_mapping: Json
          company_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          updated_at: string
        }
        Insert: {
          catalog_id: string
          column_mapping?: Json
          company_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          column_mapping?: Json
          company_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_maps_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_rows: {
        Row: {
          catalog_id: string
          company_id: string
          id: string
          raw_row: Json
          row_index: number
          search_text: string
        }
        Insert: {
          catalog_id: string
          company_id: string
          id?: string
          raw_row: Json
          row_index: number
          search_text: string
        }
        Update: {
          catalog_id?: string
          company_id?: string
          id?: string
          raw_row?: Json
          row_index?: number
          search_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_rows_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          column_mapping: Json
          company_id: string
          created_at: string
          data_bytes: number
          headers: Json
          id: string
          name: string
          original_filename: string | null
          row_count: number
          status: string
          updated_at: string
        }
        Insert: {
          column_mapping?: Json
          company_id: string
          created_at?: string
          data_bytes?: number
          headers?: Json
          id?: string
          name: string
          original_filename?: string | null
          row_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          column_mapping?: Json
          company_id?: string
          created_at?: string
          data_bytes?: number
          headers?: Json
          id?: string
          name?: string
          original_filename?: string | null
          row_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cancel_at: string | null
          cancel_at_period_end: boolean
          cancellation_confirmation_required_at: string | null
          cancellation_confirmed_at: string | null
          comp_notes: string | null
          comp_until: string | null
          created_at: string
          current_period_end: string | null
          default_currency: string
          default_labor_margin_percent: number | null
          default_language: string
          default_material_margin_percent: number | null
          default_measurement_system: Database["public"]["Enums"]["measurement_system"]
          default_tax_rate: number
          default_trade: Database["public"]["Enums"]["trade"]
          dunning_stage_entered_at: string | null
          first_payment_failure_at: string | null
          id: string
          name: string
          notification_prefs: Json
          notify_on_recipient_view: boolean
          onboarding_completed_at: string | null
          payment_details: Json | null
          plan_code: string
          plan_started_at: string
          seat_count: number
          slug: string | null
          storage_limit_bytes: number
          storage_topup_bytes: number
          storage_used_bytes: number
          stripe_customer_id: string | null
          stripe_mode: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at?: string | null
          cancel_at_period_end?: boolean
          cancellation_confirmation_required_at?: string | null
          cancellation_confirmed_at?: string | null
          comp_notes?: string | null
          comp_until?: string | null
          created_at?: string
          current_period_end?: string | null
          default_currency?: string
          default_labor_margin_percent?: number | null
          default_language?: string
          default_material_margin_percent?: number | null
          default_measurement_system?: Database["public"]["Enums"]["measurement_system"]
          default_tax_rate?: number
          default_trade?: Database["public"]["Enums"]["trade"]
          dunning_stage_entered_at?: string | null
          first_payment_failure_at?: string | null
          id?: string
          name: string
          notification_prefs?: Json
          notify_on_recipient_view?: boolean
          onboarding_completed_at?: string | null
          payment_details?: Json | null
          plan_code?: string
          plan_started_at?: string
          seat_count?: number
          slug?: string | null
          storage_limit_bytes?: number
          storage_topup_bytes?: number
          storage_used_bytes?: number
          stripe_customer_id?: string | null
          stripe_mode?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at?: string | null
          cancel_at_period_end?: boolean
          cancellation_confirmation_required_at?: string | null
          cancellation_confirmed_at?: string | null
          comp_notes?: string | null
          comp_until?: string | null
          created_at?: string
          current_period_end?: string | null
          default_currency?: string
          default_labor_margin_percent?: number | null
          default_language?: string
          default_material_margin_percent?: number | null
          default_measurement_system?: Database["public"]["Enums"]["measurement_system"]
          default_tax_rate?: number
          default_trade?: Database["public"]["Enums"]["trade"]
          dunning_stage_entered_at?: string | null
          first_payment_failure_at?: string | null
          id?: string
          name?: string
          notification_prefs?: Json
          notify_on_recipient_view?: boolean
          onboarding_completed_at?: string | null
          payment_details?: Json | null
          plan_code?: string
          plan_started_at?: string
          seat_count?: number
          slug?: string | null
          storage_limit_bytes?: number
          storage_topup_bytes?: number
          storage_used_bytes?: number
          stripe_customer_id?: string | null
          stripe_mode?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      company_attachments: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string | null
          name: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string | null
          name: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          name?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_quote_usage: {
        Row: {
          company_id: string
          period_start: string
          quotes_created: number
        }
        Insert: {
          company_id: string
          period_start: string
          quotes_created?: number
        }
        Update: {
          company_id?: string
          period_start?: string
          quotes_created?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_quote_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_taxes: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          rate_percent: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          rate_percent?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          rate_percent?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      component_collections: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_bootstrap: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_bootstrap?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_bootstrap?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_collections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      component_library: {
        Row: {
          collection_id: string | null
          company_id: string
          component_type: Database["public"]["Enums"]["component_type"]
          created_at: string
          default_labour_rate: number
          default_material_rate: number
          default_pitch_type: Database["public"]["Enums"]["pitch_type"]
          default_waste_fixed: number
          default_waste_percent: number
          default_waste_type: Database["public"]["Enums"]["waste_type"]
          depth_value_mm: number | null
          eligible_for_orders: boolean | null
          flashing_ids: string[] | null
          height_value_mm: number | null
          id: string
          is_active: boolean
          measurement_type: Database["public"]["Enums"]["measurement_type"]
          name: string
          notes: string | null
          pack_coverage_m2: number | null
          pack_price: number | null
          pack_size: number | null
          pricing_strategy: Database["public"]["Enums"]["pricing_strategy"]
          show_dimensions_default: boolean
          show_price_default: boolean
          sort_order: number
          updated_at: string
          waste_unit: Database["public"]["Enums"]["waste_unit"]
        }
        Insert: {
          collection_id?: string | null
          company_id: string
          component_type?: Database["public"]["Enums"]["component_type"]
          created_at?: string
          default_labour_rate?: number
          default_material_rate?: number
          default_pitch_type?: Database["public"]["Enums"]["pitch_type"]
          default_waste_fixed?: number
          default_waste_percent?: number
          default_waste_type?: Database["public"]["Enums"]["waste_type"]
          depth_value_mm?: number | null
          eligible_for_orders?: boolean | null
          flashing_ids?: string[] | null
          height_value_mm?: number | null
          id?: string
          is_active?: boolean
          measurement_type: Database["public"]["Enums"]["measurement_type"]
          name: string
          notes?: string | null
          pack_coverage_m2?: number | null
          pack_price?: number | null
          pack_size?: number | null
          pricing_strategy?: Database["public"]["Enums"]["pricing_strategy"]
          show_dimensions_default?: boolean
          show_price_default?: boolean
          sort_order?: number
          updated_at?: string
          waste_unit?: Database["public"]["Enums"]["waste_unit"]
        }
        Update: {
          collection_id?: string | null
          company_id?: string
          component_type?: Database["public"]["Enums"]["component_type"]
          created_at?: string
          default_labour_rate?: number
          default_material_rate?: number
          default_pitch_type?: Database["public"]["Enums"]["pitch_type"]
          default_waste_fixed?: number
          default_waste_percent?: number
          default_waste_type?: Database["public"]["Enums"]["waste_type"]
          depth_value_mm?: number | null
          eligible_for_orders?: boolean | null
          flashing_ids?: string[] | null
          height_value_mm?: number | null
          id?: string
          is_active?: boolean
          measurement_type?: Database["public"]["Enums"]["measurement_type"]
          name?: string
          notes?: string | null
          pack_coverage_m2?: number | null
          pack_price?: number | null
          pack_size?: number | null
          pricing_strategy?: Database["public"]["Enums"]["pricing_strategy"]
          show_dimensions_default?: boolean
          show_price_default?: boolean
          sort_order?: number
          updated_at?: string
          waste_unit?: Database["public"]["Enums"]["waste_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "component_library_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_component_library_collection_same_company"
            columns: ["company_id", "collection_id"]
            isOneToOne: false
            referencedRelation: "component_collections"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      contact_enquiries: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: number
          message: string
          name: string
          source: string | null
          subject: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: number
          message: string
          name: string
          source?: string | null
          subject?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: number
          message?: string
          name?: string
          source?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      copilot_progress: {
        Row: {
          company_id: string
          copilot_enabled: boolean | null
          copilot_visible: boolean | null
          created_at: string | null
          current_guide: string | null
          current_step: number | null
          guides_completed: string[] | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          copilot_enabled?: boolean | null
          copilot_visible?: boolean | null
          created_at?: string | null
          current_guide?: string | null
          current_step?: number | null
          guides_completed?: string[] | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          copilot_enabled?: boolean | null
          copilot_visible?: boolean | null
          created_at?: string | null
          current_guide?: string | null
          current_step?: number | null
          guides_completed?: string[] | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_quote_lines: {
        Row: {
          base_unit_cost: number | null
          created_at: string
          custom_amount: number | null
          custom_text: string | null
          id: string
          include_in_total: boolean | null
          is_visible: boolean
          line_labor_margin_percent: number | null
          line_margin_percent: number | null
          line_set_type: string | null
          line_type: Database["public"]["Enums"]["line_type"]
          quantity: number
          quantity_text: string | null
          quote_component_id: string | null
          quote_id: string
          show_dimensions: boolean
          show_price: boolean
          show_units: boolean | null
          sort_order: number
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          base_unit_cost?: number | null
          created_at?: string
          custom_amount?: number | null
          custom_text?: string | null
          id?: string
          include_in_total?: boolean | null
          is_visible?: boolean
          line_labor_margin_percent?: number | null
          line_margin_percent?: number | null
          line_set_type?: string | null
          line_type?: Database["public"]["Enums"]["line_type"]
          quantity?: number
          quantity_text?: string | null
          quote_component_id?: string | null
          quote_id: string
          show_dimensions?: boolean
          show_price?: boolean
          show_units?: boolean | null
          sort_order?: number
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          base_unit_cost?: number | null
          created_at?: string
          custom_amount?: number | null
          custom_text?: string | null
          id?: string
          include_in_total?: boolean | null
          is_visible?: boolean
          line_labor_margin_percent?: number | null
          line_margin_percent?: number | null
          line_set_type?: string | null
          line_type?: Database["public"]["Enums"]["line_type"]
          quantity?: number
          quantity_text?: string | null
          quote_component_id?: string | null
          quote_id?: string
          show_dimensions?: boolean
          show_price?: boolean
          show_units?: boolean | null
          sort_order?: number
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_quote_lines_quote_component_id_fkey"
            columns: ["quote_component_id"]
            isOneToOne: false
            referencedRelation: "quote_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_quote_templates: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_id: string
          company_logo_url: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          footer_text: string | null
          id: string
          is_starter_template: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_id: string
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          is_starter_template?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_id?: string
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          is_starter_template?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          heading: string
          id: string
          section: string
          slug: string
          token_count: number
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          content: string
          content_hash: string
          embedding: string
          heading?: string
          id?: string
          section?: string
          slug: string
          token_count?: number
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string
          embedding?: string
          heading?: string
          id?: string
          section?: string
          slug?: string
          token_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      docs_feedback: {
        Row: {
          app_path: string | null
          company_id: string | null
          created_at: string
          id: string
          reason: string | null
          slug: string
          user_agent: string | null
          user_id: string | null
          vote: string
        }
        Insert: {
          app_path?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          slug: string
          user_agent?: string | null
          user_id?: string | null
          vote: string
        }
        Update: {
          app_path?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          slug?: string
          user_agent?: string | null
          user_id?: string | null
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "docs_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      early_access: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          attachment_id: string | null
          body: string
          category: string | null
          company_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          kind: string
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          attachment_id?: string | null
          body?: string
          category?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          kind?: string
          name: string
          subject?: string
          updated_at?: string | null
        }
        Update: {
          attachment_id?: string | null
          body?: string
          category?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          kind?: string
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "company_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      flashing_library: {
        Row: {
          canvas_data: Json | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_default: boolean | null
          measurements: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          canvas_data?: Json | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_default?: boolean | null
          measurements?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          canvas_data?: Json | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_default?: boolean | null
          measurements?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashing_library_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_briefs: {
        Row: {
          date: string
          generated_at: string | null
          id: string
          metrics_snapshot: Json | null
          narrative: string | null
          recommendations: Json | null
        }
        Insert: {
          date: string
          generated_at?: string | null
          id?: string
          metrics_snapshot?: Json | null
          narrative?: string | null
          recommendations?: Json | null
        }
        Update: {
          date?: string
          generated_at?: string | null
          id?: string
          metrics_snapshot?: Json | null
          narrative?: string | null
          recommendations?: Json | null
        }
        Relationships: []
      }
      insight_email_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          insight_next_move: string | null
          insight_text: string | null
          insight_title: string | null
          marketing_consent: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          insight_next_move?: string | null
          insight_text?: string | null
          insight_title?: string | null
          marketing_consent?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          insight_next_move?: string | null
          insight_text?: string | null
          insight_title?: string | null
          marketing_consent?: boolean | null
        }
        Relationships: []
      }
      invoice_activity: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          id: string
          invoice_id: string
          metadata: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          invoice_id: string
          metadata?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_activity_invoice_company_fk"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoice_activity_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_disputes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          message: string
          reason: string
          recipient_email: string | null
          recipient_name: string
          resolved_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          message?: string
          reason?: string
          recipient_email?: string | null
          recipient_name?: string
          resolved_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          message?: string
          reason?: string
          recipient_email?: string | null
          recipient_name?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_disputes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_disputes_invoice_company_fk"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoice_disputes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          include_in_total: boolean
          invoice_id: string
          is_visible: boolean
          line_source_type: string
          line_total: number
          quantity: number
          show_description: boolean
          show_price: boolean
          show_quantity: boolean
          sort_order: number
          source_id: string | null
          title: string
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          include_in_total?: boolean
          invoice_id: string
          is_visible?: boolean
          line_source_type?: string
          line_total?: number
          quantity?: number
          show_description?: boolean
          show_price?: boolean
          show_quantity?: boolean
          sort_order?: number
          source_id?: string | null
          title?: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          include_in_total?: boolean
          invoice_id?: string
          is_visible?: boolean
          line_source_type?: string
          line_total?: number
          quantity?: number
          show_description?: boolean
          show_price?: boolean
          show_quantity?: boolean
          sort_order?: number
          source_id?: string | null
          title?: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_company_fk"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_sequences: {
        Row: {
          company_id: string
          created_at: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          next_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_id: string
          company_logo_url: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          default_notes: string | null
          default_terms: string | null
          footer_text: string | null
          id: string
          name: string
          payment_account_name: string | null
          payment_account_number: string | null
          payment_bank_name: string | null
          payment_link: string | null
          payment_sort_code: string | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_id: string
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_notes?: string | null
          default_terms?: string | null
          footer_text?: string | null
          id?: string
          name?: string
          payment_account_name?: string | null
          payment_account_number?: string | null
          payment_bank_name?: string | null
          payment_link?: string | null
          payment_sort_code?: string | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_id?: string
          company_logo_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_notes?: string | null
          default_terms?: string | null
          footer_text?: string | null
          id?: string
          name?: string
          payment_account_name?: string | null
          payment_account_number?: string | null
          payment_bank_name?: string | null
          payment_link?: string | null
          payment_sort_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_snapshot: Json
          cancelled_at: string | null
          company_id: string
          cq_company_address: string | null
          cq_company_email: string | null
          cq_company_logo_url: string | null
          cq_company_name: string | null
          cq_company_phone: string | null
          cq_footer_text: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_snapshot: Json
          discount_total: number
          disputed_at: string | null
          due_date: string | null
          hide_line_prices: boolean
          hide_totals: boolean
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_details: Json | null
          payment_reference: string
          payment_reported_at: string | null
          public_token: string
          sent_at: string | null
          source_id: string | null
          source_type: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          template_id: string | null
          terms: string | null
          total: number
          updated_at: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          business_snapshot?: Json
          cancelled_at?: string | null
          company_id: string
          cq_company_address?: string | null
          cq_company_email?: string | null
          cq_company_logo_url?: string | null
          cq_company_name?: string | null
          cq_company_phone?: string | null
          cq_footer_text?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_snapshot?: Json
          discount_total?: number
          disputed_at?: string | null
          due_date?: string | null
          hide_line_prices?: boolean
          hide_totals?: boolean
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_details?: Json | null
          payment_reference: string
          payment_reported_at?: string | null
          public_token?: string
          sent_at?: string | null
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          template_id?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          business_snapshot?: Json
          cancelled_at?: string | null
          company_id?: string
          cq_company_address?: string | null
          cq_company_email?: string | null
          cq_company_logo_url?: string | null
          cq_company_name?: string | null
          cq_company_phone?: string | null
          cq_footer_text?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_snapshot?: Json
          discount_total?: number
          disputed_at?: string | null
          due_date?: string | null
          hide_line_prices?: boolean
          hide_totals?: boolean
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_details?: Json | null
          payment_reference?: string
          payment_reported_at?: string | null
          public_token?: string
          sent_at?: string | null
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          template_id?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_sheet_lines: {
        Row: {
          created_at: string
          custom_amount: number
          custom_text: string
          id: string
          include_in_total: boolean
          is_visible: boolean
          line_type: string
          quote_component_id: string | null
          quote_id: string
          show_price: boolean
          show_units: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_amount?: number
          custom_text: string
          id?: string
          include_in_total?: boolean
          is_visible?: boolean
          line_type: string
          quote_component_id?: string | null
          quote_id: string
          show_price?: boolean
          show_units?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_amount?: number
          custom_text?: string
          id?: string
          include_in_total?: boolean
          is_visible?: boolean
          line_type?: string
          quote_component_id?: string | null
          quote_id?: string
          show_price?: boolean
          show_units?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_sheet_lines_quote_component_id_fkey"
            columns: ["quote_component_id"]
            isOneToOne: false
            referencedRelation: "quote_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_sheet_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          current_page_at_signup: string | null
          email: string
          first_page_seen: string | null
          form_type: string | null
          id: string
          landing_page: string | null
          ref: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          current_page_at_signup?: string | null
          email: string
          first_page_seen?: string | null
          form_type?: string | null
          id?: string
          landing_page?: string | null
          ref?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          current_page_at_signup?: string | null
          email?: string
          first_page_seen?: string | null
          form_type?: string | null
          id?: string
          landing_page?: string | null
          ref?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      material_order_lines: {
        Row: {
          component_id: string | null
          created_at: string
          entry_mode: string | null
          flashing_id: string | null
          flashing_image_url: string | null
          id: string
          item_name: string
          item_notes: string | null
          length_unit: string | null
          lengths: Json | null
          measurement_display: string | null
          order_id: string
          priced_quantity: number | null
          quantity: number | null
          show_component_name: boolean | null
          show_flashing_image: boolean | null
          show_measurements: boolean | null
          sort_order: number
          unit: string | null
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          entry_mode?: string | null
          flashing_id?: string | null
          flashing_image_url?: string | null
          id?: string
          item_name: string
          item_notes?: string | null
          length_unit?: string | null
          lengths?: Json | null
          measurement_display?: string | null
          order_id: string
          priced_quantity?: number | null
          quantity?: number | null
          show_component_name?: boolean | null
          show_flashing_image?: boolean | null
          show_measurements?: boolean | null
          sort_order?: number
          unit?: string | null
        }
        Update: {
          component_id?: string | null
          created_at?: string
          entry_mode?: string | null
          flashing_id?: string | null
          flashing_image_url?: string | null
          id?: string
          item_name?: string
          item_notes?: string | null
          length_unit?: string | null
          lengths?: Json | null
          measurement_display?: string | null
          order_id?: string
          priced_quantity?: number | null
          quantity?: number | null
          show_component_name?: boolean | null
          show_flashing_image?: boolean | null
          show_measurements?: boolean | null
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_order_lines_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_order_lines_flashing_id_fkey"
            columns: ["flashing_id"]
            isOneToOne: false
            referencedRelation: "flashing_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      material_order_responses: {
        Row: {
          action: string
          body: string | null
          company_id: string
          created_at: string
          id: string
          ip: string | null
          order_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          ip?: string | null
          order_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          order_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_order_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_order_responses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      material_order_templates: {
        Row: {
          company_id: string
          created_at: string
          default_colours: string[] | null
          default_contact_details: string | null
          default_contact_person: string | null
          default_delivery_address: string | null
          default_from_company: string | null
          default_header_notes: string | null
          default_logo_url: string | null
          default_order_type: string | null
          default_reference: string | null
          default_supplier_contact: string | null
          default_supplier_email: string | null
          default_supplier_name: string | null
          default_supplier_phone: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_colours?: string[] | null
          default_contact_details?: string | null
          default_contact_person?: string | null
          default_delivery_address?: string | null
          default_from_company?: string | null
          default_header_notes?: string | null
          default_logo_url?: string | null
          default_order_type?: string | null
          default_reference?: string | null
          default_supplier_contact?: string | null
          default_supplier_email?: string | null
          default_supplier_name?: string | null
          default_supplier_phone?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_colours?: string[] | null
          default_contact_details?: string | null
          default_contact_person?: string | null
          default_delivery_address?: string | null
          default_from_company?: string | null
          default_header_notes?: string | null
          default_logo_url?: string | null
          default_order_type?: string | null
          default_reference?: string | null
          default_supplier_contact?: string | null
          default_supplier_email?: string | null
          default_supplier_name?: string | null
          default_supplier_phone?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_order_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_orders: {
        Row: {
          acceptance_token: string | null
          acceptance_token_expires_at: string | null
          changes_requested_at: string | null
          colours: string | null
          company_id: string
          confirmed_at: string | null
          contact_details: string | null
          contact_person: string | null
          created_at: string
          declined_at: string | null
          delivery_address: string | null
          delivery_date: string | null
          from_company: string | null
          header_notes: string | null
          id: string
          info_requested_at: string | null
          is_sent: boolean | null
          job_colours: string[] | null
          job_name: string | null
          last_supplier_response_at: string | null
          layout_mode: string | null
          line_by_line_data: Json | null
          logo_url: string | null
          order_date: string | null
          order_number: string
          order_type: string | null
          pdf_url: string | null
          quote_id: string | null
          reference: string | null
          status: string
          supplier_contact: string | null
          supplier_name: string | null
          template_id: string | null
          to_supplier: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          acceptance_token?: string | null
          acceptance_token_expires_at?: string | null
          changes_requested_at?: string | null
          colours?: string | null
          company_id: string
          confirmed_at?: string | null
          contact_details?: string | null
          contact_person?: string | null
          created_at?: string
          declined_at?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          from_company?: string | null
          header_notes?: string | null
          id?: string
          info_requested_at?: string | null
          is_sent?: boolean | null
          job_colours?: string[] | null
          job_name?: string | null
          last_supplier_response_at?: string | null
          layout_mode?: string | null
          line_by_line_data?: Json | null
          logo_url?: string | null
          order_date?: string | null
          order_number: string
          order_type?: string | null
          pdf_url?: string | null
          quote_id?: string | null
          reference?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_name?: string | null
          template_id?: string | null
          to_supplier?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          acceptance_token?: string | null
          acceptance_token_expires_at?: string | null
          changes_requested_at?: string | null
          colours?: string | null
          company_id?: string
          confirmed_at?: string | null
          contact_details?: string | null
          contact_person?: string | null
          created_at?: string
          declined_at?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          from_company?: string | null
          header_notes?: string | null
          id?: string
          info_requested_at?: string | null
          is_sent?: boolean | null
          job_colours?: string[] | null
          job_name?: string | null
          last_supplier_response_at?: string | null
          layout_mode?: string | null
          line_by_line_data?: Json | null
          logo_url?: string | null
          order_date?: string | null
          order_number?: string
          order_type?: string | null
          pdf_url?: string | null
          quote_id?: string | null
          reference?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_name?: string | null
          template_id?: string | null
          to_supplier?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "material_order_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          access_token: string | null
          company_id: string
          created_at: string
          display_name: string
          id: string
          library_attachment_id: string | null
          order_id: string | null
          quote_file_id: string | null
          quote_id: string | null
        }
        Insert: {
          access_token?: string | null
          company_id: string
          created_at?: string
          display_name: string
          id?: string
          library_attachment_id?: string | null
          order_id?: string | null
          quote_file_id?: string | null
          quote_id?: string | null
        }
        Update: {
          access_token?: string | null
          company_id?: string
          created_at?: string
          display_name?: string
          id?: string
          library_attachment_id?: string | null
          order_id?: string | null
          quote_file_id?: string | null
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_library_attachment_id_fkey"
            columns: ["library_attachment_id"]
            isOneToOne: false
            referencedRelation: "company_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_quote_file_id_fkey"
            columns: ["quote_file_id"]
            isOneToOne: false
            referencedRelation: "quote_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_suppressions: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          reason: string | null
          source_message_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          reason?: string | null
          source_message_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
          source_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_suppressions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_suppressions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_message_replies: {
        Row: {
          action: string
          body: string | null
          company_id: string
          created_at: string
          id: string
          ip: string | null
          message_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          ip?: string | null
          message_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          message_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_message_replies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          kind: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          related_invoice_id: string | null
          related_order_id: string | null
          related_quote_id: string | null
          replied_at: string | null
          reply_token: string
          send_error: string | null
          sender_user_id: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          kind: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          replied_at?: string | null
          reply_token: string
          send_error?: string | null
          sender_user_id: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          replied_at?: string | null
          reply_token?: string
          send_error?: string | null
          sender_user_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_quote_id_fkey"
            columns: ["related_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_component_entries: {
        Row: {
          combined_from: Json | null
          created_at: string
          id: string
          is_combined: boolean
          page_id: string | null
          quote_component_id: string
          raw_value: number
          sort_order: number
          value_after_waste: number
        }
        Insert: {
          combined_from?: Json | null
          created_at?: string
          id?: string
          is_combined?: boolean
          page_id?: string | null
          quote_component_id: string
          raw_value: number
          sort_order?: number
          value_after_waste: number
        }
        Update: {
          combined_from?: Json | null
          created_at?: string
          id?: string
          is_combined?: boolean
          page_id?: string | null
          quote_component_id?: string
          raw_value?: number
          sort_order?: number
          value_after_waste?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_component_entries_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "takeoff_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_component_entries_quote_component_id_fkey"
            columns: ["quote_component_id"]
            isOneToOne: false
            referencedRelation: "quote_components"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_components: {
        Row: {
          calc_pitch_degrees: number | null
          calc_pitch_factor: number | null
          calc_raw_value: number | null
          component_library_id: string | null
          component_type: Database["public"]["Enums"]["component_type"]
          created_at: string
          custom_pitch_degrees: number | null
          final_quantity: number | null
          final_value: number | null
          id: string
          input_mode: Database["public"]["Enums"]["input_mode"]
          is_customer_visible: boolean
          is_pitch_overridden: boolean
          is_quantity_overridden: boolean
          is_rate_overridden: boolean
          is_waste_overridden: boolean
          labour_cost: number
          labour_rate: number
          material_cost: number
          material_rate: number
          measurement_type: Database["public"]["Enums"]["measurement_type"]
          name: string
          pack_size_snapshot: number | null
          pitch_type: Database["public"]["Enums"]["pitch_type"]
          priced_quantity: number | null
          pricing_unit: string | null
          quote_id: string
          quote_roof_area_id: string | null
          sort_order: number
          template_component_id: string | null
          updated_at: string
          use_custom_pitch: boolean
          waste_fixed: number
          waste_percent: number
          waste_type: Database["public"]["Enums"]["waste_type"]
        }
        Insert: {
          calc_pitch_degrees?: number | null
          calc_pitch_factor?: number | null
          calc_raw_value?: number | null
          component_library_id?: string | null
          component_type?: Database["public"]["Enums"]["component_type"]
          created_at?: string
          custom_pitch_degrees?: number | null
          final_quantity?: number | null
          final_value?: number | null
          id?: string
          input_mode?: Database["public"]["Enums"]["input_mode"]
          is_customer_visible?: boolean
          is_pitch_overridden?: boolean
          is_quantity_overridden?: boolean
          is_rate_overridden?: boolean
          is_waste_overridden?: boolean
          labour_cost?: number
          labour_rate?: number
          material_cost?: number
          material_rate?: number
          measurement_type: Database["public"]["Enums"]["measurement_type"]
          name: string
          pack_size_snapshot?: number | null
          pitch_type?: Database["public"]["Enums"]["pitch_type"]
          priced_quantity?: number | null
          pricing_unit?: string | null
          quote_id: string
          quote_roof_area_id?: string | null
          sort_order?: number
          template_component_id?: string | null
          updated_at?: string
          use_custom_pitch?: boolean
          waste_fixed?: number
          waste_percent?: number
          waste_type?: Database["public"]["Enums"]["waste_type"]
        }
        Update: {
          calc_pitch_degrees?: number | null
          calc_pitch_factor?: number | null
          calc_raw_value?: number | null
          component_library_id?: string | null
          component_type?: Database["public"]["Enums"]["component_type"]
          created_at?: string
          custom_pitch_degrees?: number | null
          final_quantity?: number | null
          final_value?: number | null
          id?: string
          input_mode?: Database["public"]["Enums"]["input_mode"]
          is_customer_visible?: boolean
          is_pitch_overridden?: boolean
          is_quantity_overridden?: boolean
          is_rate_overridden?: boolean
          is_waste_overridden?: boolean
          labour_cost?: number
          labour_rate?: number
          material_cost?: number
          material_rate?: number
          measurement_type?: Database["public"]["Enums"]["measurement_type"]
          name?: string
          pack_size_snapshot?: number | null
          pitch_type?: Database["public"]["Enums"]["pitch_type"]
          priced_quantity?: number | null
          pricing_unit?: string | null
          quote_id?: string
          quote_roof_area_id?: string | null
          sort_order?: number
          template_component_id?: string | null
          updated_at?: string
          use_custom_pitch?: boolean
          waste_fixed?: number
          waste_percent?: number
          waste_type?: Database["public"]["Enums"]["waste_type"]
        }
        Relationships: [
          {
            foreignKeyName: "quote_components_component_library_id_fkey"
            columns: ["component_library_id"]
            isOneToOne: false
            referencedRelation: "component_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_components_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_components_quote_roof_area_id_fkey"
            columns: ["quote_roof_area_id"]
            isOneToOne: false
            referencedRelation: "quote_roof_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_components_template_component_id_fkey"
            columns: ["template_component_id"]
            isOneToOne: false
            referencedRelation: "template_components"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_files: {
        Row: {
          company_id: string
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          mime_type: string
          quote_id: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          mime_type: string
          quote_id?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string
          quote_id?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_notes: {
        Row: {
          body: string
          company_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          quote_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          quote_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          quote_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_notes_quote_company_fk"
            columns: ["quote_id", "company_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "quote_notes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_number_sequences: {
        Row: {
          company_id: string
          created_at: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          next_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_number_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_revision_requests: {
        Row: {
          company_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          notes: string
          quote_id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          source_state: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          notes: string
          quote_id: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          source_state?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          notes?: string
          quote_id?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          source_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_revision_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_revision_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_revision_requests_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_roof_area_entries: {
        Row: {
          created_at: string | null
          id: string
          length_m: number
          quote_roof_area_id: string
          sort_order: number | null
          sqm: number
          updated_at: string | null
          width_m: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          length_m: number
          quote_roof_area_id: string
          sort_order?: number | null
          sqm: number
          updated_at?: string | null
          width_m: number
        }
        Update: {
          created_at?: string | null
          id?: string
          length_m?: number
          quote_roof_area_id?: string
          sort_order?: number | null
          sqm?: number
          updated_at?: string | null
          width_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_roof_area_entries_quote_roof_area_id_fkey"
            columns: ["quote_roof_area_id"]
            isOneToOne: false
            referencedRelation: "quote_roof_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_roof_areas: {
        Row: {
          calc_length_m: number | null
          calc_pitch_degrees: number | null
          calc_plan_sqm: number | null
          calc_width_m: number | null
          computed_sqm: number | null
          created_at: string
          final_value_sqm: number | null
          id: string
          input_mode: Database["public"]["Enums"]["input_mode"]
          is_locked: boolean | null
          label: string
          quote_id: string
          sort_order: number
          template_roof_area_id: string | null
          updated_at: string
        }
        Insert: {
          calc_length_m?: number | null
          calc_pitch_degrees?: number | null
          calc_plan_sqm?: number | null
          calc_width_m?: number | null
          computed_sqm?: number | null
          created_at?: string
          final_value_sqm?: number | null
          id?: string
          input_mode?: Database["public"]["Enums"]["input_mode"]
          is_locked?: boolean | null
          label: string
          quote_id: string
          sort_order?: number
          template_roof_area_id?: string | null
          updated_at?: string
        }
        Update: {
          calc_length_m?: number | null
          calc_pitch_degrees?: number | null
          calc_plan_sqm?: number | null
          calc_width_m?: number | null
          computed_sqm?: number | null
          created_at?: string
          final_value_sqm?: number | null
          id?: string
          input_mode?: Database["public"]["Enums"]["input_mode"]
          is_locked?: boolean | null
          label?: string
          quote_id?: string
          sort_order?: number
          template_roof_area_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_roof_areas_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_roof_areas_template_roof_area_id_fkey"
            columns: ["template_roof_area_id"]
            isOneToOne: false
            referencedRelation: "template_roof_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_takeoff_measurements: {
        Row: {
          canvas_points: Json | null
          company_id: string
          component_library_id: string | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          measurement_type: string
          measurement_unit: string
          measurement_value: number
          page_id: string | null
          quote_id: string
          unassigned: boolean
          updated_at: string | null
        }
        Insert: {
          canvas_points?: Json | null
          company_id: string
          component_library_id?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          measurement_type: string
          measurement_unit: string
          measurement_value: number
          page_id?: string | null
          quote_id: string
          unassigned?: boolean
          updated_at?: string | null
        }
        Update: {
          canvas_points?: Json | null
          company_id?: string
          component_library_id?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          measurement_type?: string
          measurement_unit?: string
          measurement_value?: number
          page_id?: string | null
          quote_id?: string
          unassigned?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_takeoff_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_takeoff_measurements_component_library_id_fkey"
            columns: ["component_library_id"]
            isOneToOne: false
            referencedRelation: "component_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_takeoff_measurements_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "takeoff_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_takeoff_measurements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_taxes: {
        Row: {
          created_at: string
          id: string
          include_in_labor: boolean
          include_in_quote: boolean
          name: string
          quote_id: string
          rate_percent: number
          sort_order: number
          source_tax_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_in_labor?: boolean
          include_in_quote?: boolean
          name: string
          quote_id: string
          rate_percent?: number
          sort_order?: number
          source_tax_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          include_in_labor?: boolean
          include_in_quote?: boolean
          name?: string
          quote_id?: string
          rate_percent?: number
          sort_order?: number
          source_tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_taxes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_taxes_source_tax_id_fkey"
            columns: ["source_tax_id"]
            isOneToOne: false
            referencedRelation: "company_taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          acceptance_token: string | null
          acceptance_token_expires_at: string | null
          accepted_at: string | null
          company_id: string
          component_collection_id: string | null
          cq_company_address: string | null
          cq_company_email: string | null
          cq_company_logo_url: string | null
          cq_company_name: string | null
          cq_company_phone: string | null
          cq_footer_text: string | null
          created_at: string
          created_by_email: string | null
          created_by_user_id: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          declined_at: string | null
          entry_mode: string | null
          global_margin_percent: number | null
          global_pitch_degrees: number | null
          hide_line_prices: boolean
          hide_totals: boolean
          id: string
          job_name: string | null
          job_status: string | null
          labor_margin_enabled: boolean | null
          labor_margin_percent: number | null
          material_margin_enabled: boolean | null
          material_margin_percent: number | null
          measurement_system: Database["public"]["Enums"]["measurement_system"]
          notes_internal: string | null
          original_summary_snapshot: Json | null
          quote_number: number | null
          show_margin_in_preview: boolean
          show_quantity_column: boolean
          site_address: string | null
          status: Database["public"]["Enums"]["quote_status"]
          takeoff_canvas_path: string | null
          takeoff_canvas_url: string | null
          takeoff_lines_path: string | null
          takeoff_lines_url: string | null
          tax_rate: number
          template_id: string | null
          trade: Database["public"]["Enums"]["trade"]
          updated_at: string
          viewed_at: string | null
          withdrawn_at: string | null
          withdrawn_by_user_id: string | null
        }
        Insert: {
          acceptance_token?: string | null
          acceptance_token_expires_at?: string | null
          accepted_at?: string | null
          company_id: string
          component_collection_id?: string | null
          cq_company_address?: string | null
          cq_company_email?: string | null
          cq_company_logo_url?: string | null
          cq_company_name?: string | null
          cq_company_phone?: string | null
          cq_footer_text?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          declined_at?: string | null
          entry_mode?: string | null
          global_margin_percent?: number | null
          global_pitch_degrees?: number | null
          hide_line_prices?: boolean
          hide_totals?: boolean
          id?: string
          job_name?: string | null
          job_status?: string | null
          labor_margin_enabled?: boolean | null
          labor_margin_percent?: number | null
          material_margin_enabled?: boolean | null
          material_margin_percent?: number | null
          measurement_system?: Database["public"]["Enums"]["measurement_system"]
          notes_internal?: string | null
          original_summary_snapshot?: Json | null
          quote_number?: number | null
          show_margin_in_preview?: boolean
          show_quantity_column?: boolean
          site_address?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          takeoff_canvas_path?: string | null
          takeoff_canvas_url?: string | null
          takeoff_lines_path?: string | null
          takeoff_lines_url?: string | null
          tax_rate?: number
          template_id?: string | null
          trade?: Database["public"]["Enums"]["trade"]
          updated_at?: string
          viewed_at?: string | null
          withdrawn_at?: string | null
          withdrawn_by_user_id?: string | null
        }
        Update: {
          acceptance_token?: string | null
          acceptance_token_expires_at?: string | null
          accepted_at?: string | null
          company_id?: string
          component_collection_id?: string | null
          cq_company_address?: string | null
          cq_company_email?: string | null
          cq_company_logo_url?: string | null
          cq_company_name?: string | null
          cq_company_phone?: string | null
          cq_footer_text?: string | null
          created_at?: string
          created_by_email?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          declined_at?: string | null
          entry_mode?: string | null
          global_margin_percent?: number | null
          global_pitch_degrees?: number | null
          hide_line_prices?: boolean
          hide_totals?: boolean
          id?: string
          job_name?: string | null
          job_status?: string | null
          labor_margin_enabled?: boolean | null
          labor_margin_percent?: number | null
          material_margin_enabled?: boolean | null
          material_margin_percent?: number | null
          measurement_system?: Database["public"]["Enums"]["measurement_system"]
          notes_internal?: string | null
          original_summary_snapshot?: Json | null
          quote_number?: number | null
          show_margin_in_preview?: boolean
          show_quantity_column?: boolean
          site_address?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          takeoff_canvas_path?: string | null
          takeoff_canvas_url?: string | null
          takeoff_lines_path?: string | null
          takeoff_lines_url?: string | null
          tax_rate?: number
          template_id?: string | null
          trade?: Database["public"]["Enums"]["trade"]
          updated_at?: string
          viewed_at?: string | null
          withdrawn_at?: string | null
          withdrawn_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotes_component_collection_same_company"
            columns: ["company_id", "component_collection_id"]
            isOneToOne: false
            referencedRelation: "component_collections"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_withdrawn_by_user_id_fkey"
            columns: ["withdrawn_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket_key: string
          count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          cancelled_reason: string | null
          claimed_at: string | null
          company_id: string
          created_at: string
          created_by_user_id: string
          failed_error: string | null
          fire_at: string
          fired_at: string | null
          id: string
          invoice_id: string | null
          order_id: string | null
          outbound_message_id: string | null
          pending_wait_days: number | null
          pending_wait_hours: number | null
          pending_wait_minutes: number | null
          quote_id: string | null
          recipient_email: string
          recipient_name: string | null
          require_no_response: boolean
          respect_quiet_hours: boolean
          status: string
          template_id: string | null
          trigger_anchor_at: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          cancelled_reason?: string | null
          claimed_at?: string | null
          company_id: string
          created_at?: string
          created_by_user_id: string
          failed_error?: string | null
          fire_at: string
          fired_at?: string | null
          id?: string
          invoice_id?: string | null
          order_id?: string | null
          outbound_message_id?: string | null
          pending_wait_days?: number | null
          pending_wait_hours?: number | null
          pending_wait_minutes?: number | null
          quote_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          require_no_response?: boolean
          respect_quiet_hours?: boolean
          status?: string
          template_id?: string | null
          trigger_anchor_at: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          cancelled_reason?: string | null
          claimed_at?: string | null
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          failed_error?: string | null
          fire_at?: string
          fired_at?: string | null
          id?: string
          invoice_id?: string | null
          order_id?: string | null
          outbound_message_id?: string | null
          pending_wait_days?: number | null
          pending_wait_hours?: number | null
          pending_wait_minutes?: number | null
          quote_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          require_no_response?: boolean
          respect_quiet_hours?: boolean
          status?: string
          template_id?: string | null
          trigger_anchor_at?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          event_type: string
          from_plan_code: string | null
          from_status: string | null
          id: string
          notes: string | null
          stripe_event_created: string | null
          stripe_event_id: string | null
          stripe_event_type: string | null
          stripe_payload: Json | null
          to_plan_code: string | null
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          event_type: string
          from_plan_code?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          stripe_event_created?: string | null
          stripe_event_id?: string | null
          stripe_event_type?: string | null
          stripe_payload?: Json | null
          to_plan_code?: string | null
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          event_type?: string
          from_plan_code?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          stripe_event_created?: string | null
          stripe_event_id?: string | null
          stripe_event_type?: string | null
          stripe_payload?: Json | null
          to_plan_code?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          attachment_limit: number | null
          catalog_limit: number | null
          code: string
          coming_soon: boolean
          component_limit: number | null
          created_at: string
          display_name: string
          feat_activity_card: boolean
          feat_attachment_library: boolean
          feat_catalogs: boolean
          feat_digital_takeoff: boolean
          feat_email_send: boolean
          feat_flashings: boolean
          feat_followups: boolean
          feat_invoices: boolean
          feat_material_orders: boolean
          feat_message_center: boolean
          feature_blurbs: string[]
          flashing_limit: number | null
          included_seats: number
          monthly_ai_tokens: number | null
          monthly_invoice_limit: number | null
          monthly_material_order_limit: number | null
          monthly_quote_limit: number
          price_cents_monthly: number
          price_cents_monthly_original: number | null
          sort_order: number
          storage_limit_bytes: number
          stripe_launch_coupon_id: string | null
          stripe_price_id_live: string | null
          stripe_price_id_test: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          attachment_limit?: number | null
          catalog_limit?: number | null
          code: string
          coming_soon?: boolean
          component_limit?: number | null
          created_at?: string
          display_name: string
          feat_activity_card?: boolean
          feat_attachment_library?: boolean
          feat_catalogs?: boolean
          feat_digital_takeoff?: boolean
          feat_email_send?: boolean
          feat_flashings?: boolean
          feat_followups?: boolean
          feat_invoices?: boolean
          feat_material_orders?: boolean
          feat_message_center?: boolean
          feature_blurbs?: string[]
          flashing_limit?: number | null
          included_seats?: number
          monthly_ai_tokens?: number | null
          monthly_invoice_limit?: number | null
          monthly_material_order_limit?: number | null
          monthly_quote_limit: number
          price_cents_monthly: number
          price_cents_monthly_original?: number | null
          sort_order: number
          storage_limit_bytes: number
          stripe_launch_coupon_id?: string | null
          stripe_price_id_live?: string | null
          stripe_price_id_test?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          attachment_limit?: number | null
          catalog_limit?: number | null
          code?: string
          coming_soon?: boolean
          component_limit?: number | null
          created_at?: string
          display_name?: string
          feat_activity_card?: boolean
          feat_attachment_library?: boolean
          feat_catalogs?: boolean
          feat_digital_takeoff?: boolean
          feat_email_send?: boolean
          feat_flashings?: boolean
          feat_followups?: boolean
          feat_invoices?: boolean
          feat_material_orders?: boolean
          feat_message_center?: boolean
          feature_blurbs?: string[]
          flashing_limit?: number | null
          included_seats?: number
          monthly_ai_tokens?: number | null
          monthly_invoice_limit?: number | null
          monthly_material_order_limit?: number | null
          monthly_quote_limit?: number
          price_cents_monthly?: number
          price_cents_monthly_original?: number | null
          sort_order?: number
          storage_limit_bytes?: number
          stripe_launch_coupon_id?: string | null
          stripe_price_id_live?: string | null
          stripe_price_id_test?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          app_version: string | null
          assignee_user_id: string | null
          auto_close_at: string | null
          body: string
          category: string
          company_id: string
          created_at: string
          created_by_system: boolean
          email_forward_error: string | null
          email_forwarded_at: string | null
          id: string
          messages: Json
          page_context: string | null
          priority: string
          related_stripe_charge_id: string | null
          related_stripe_dispute_id: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          assignee_user_id?: string | null
          auto_close_at?: string | null
          body: string
          category?: string
          company_id: string
          created_at?: string
          created_by_system?: boolean
          email_forward_error?: string | null
          email_forwarded_at?: string | null
          id?: string
          messages?: Json
          page_context?: string | null
          priority?: string
          related_stripe_charge_id?: string | null
          related_stripe_dispute_id?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          assignee_user_id?: string | null
          auto_close_at?: string | null
          body?: string
          category?: string
          company_id?: string
          created_at?: string
          created_by_system?: boolean
          email_forward_error?: string | null
          email_forwarded_at?: string | null
          id?: string
          messages?: Json
          page_context?: string | null
          priority?: string
          related_stripe_charge_id?: string | null
          related_stripe_dispute_id?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_pages: {
        Row: {
          canvas_image_path: string | null
          created_at: string
          id: string
          image_storage_path: string | null
          lines_image_path: string | null
          page_name: string | null
          page_order: number
          pan_zoom_state: Json | null
          quote_id: string
          quote_roof_area_id: string | null
          scale_calibration: Json | null
          session_id: string
        }
        Insert: {
          canvas_image_path?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          lines_image_path?: string | null
          page_name?: string | null
          page_order?: number
          pan_zoom_state?: Json | null
          quote_id: string
          quote_roof_area_id?: string | null
          scale_calibration?: Json | null
          session_id: string
        }
        Update: {
          canvas_image_path?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          lines_image_path?: string | null
          page_name?: string | null
          page_order?: number
          pan_zoom_state?: Json | null
          quote_id?: string
          quote_roof_area_id?: string | null
          scale_calibration?: Json | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_takeoff_pages_session_quote"
            columns: ["session_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "takeoff_sessions"
            referencedColumns: ["id", "quote_id"]
          },
          {
            foreignKeyName: "takeoff_pages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_pages_quote_roof_area_id_fkey"
            columns: ["quote_roof_area_id"]
            isOneToOne: false
            referencedRelation: "quote_roof_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_sessions: {
        Row: {
          created_at: string
          id: string
          quote_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          quote_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          quote_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_sessions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      template_components: {
        Row: {
          component_library_id: string
          component_type: Database["public"]["Enums"]["component_type"]
          created_at: string
          id: string
          is_included_by_default: boolean
          override_labour_rate: number | null
          override_material_rate: number | null
          override_pitch_type: Database["public"]["Enums"]["pitch_type"] | null
          override_waste_fixed: number | null
          override_waste_percent: number | null
          override_waste_type: Database["public"]["Enums"]["waste_type"] | null
          sort_order: number
          template_id: string
          template_roof_area_id: string | null
        }
        Insert: {
          component_library_id: string
          component_type?: Database["public"]["Enums"]["component_type"]
          created_at?: string
          id?: string
          is_included_by_default?: boolean
          override_labour_rate?: number | null
          override_material_rate?: number | null
          override_pitch_type?: Database["public"]["Enums"]["pitch_type"] | null
          override_waste_fixed?: number | null
          override_waste_percent?: number | null
          override_waste_type?: Database["public"]["Enums"]["waste_type"] | null
          sort_order?: number
          template_id: string
          template_roof_area_id?: string | null
        }
        Update: {
          component_library_id?: string
          component_type?: Database["public"]["Enums"]["component_type"]
          created_at?: string
          id?: string
          is_included_by_default?: boolean
          override_labour_rate?: number | null
          override_material_rate?: number | null
          override_pitch_type?: Database["public"]["Enums"]["pitch_type"] | null
          override_waste_fixed?: number | null
          override_waste_percent?: number | null
          override_waste_type?: Database["public"]["Enums"]["waste_type"] | null
          sort_order?: number
          template_id?: string
          template_roof_area_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_components_component_library_id_fkey"
            columns: ["component_library_id"]
            isOneToOne: false
            referencedRelation: "component_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_components_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_components_template_roof_area_id_fkey"
            columns: ["template_roof_area_id"]
            isOneToOne: false
            referencedRelation: "template_roof_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      template_roof_areas: {
        Row: {
          created_at: string
          default_input_mode: Database["public"]["Enums"]["input_mode"]
          id: string
          label: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          default_input_mode?: Database["public"]["Enums"]["input_mode"]
          id?: string
          label: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          default_input_mode?: Database["public"]["Enums"]["input_mode"]
          id?: string
          label?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_roof_areas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          company_id: string
          created_at: string
          customer_template_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          roofing_profile: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_template_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          roofing_profile?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_template_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          roofing_profile?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_customer_template_id_fkey"
            columns: ["customer_template_id"]
            isOneToOne: false
            referencedRelation: "customer_quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_security_questions: {
        Row: {
          answer_hash: string
          created_at: string
          id: string
          question: string
          slot: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_hash: string
          created_at?: string
          id?: string
          question: string
          slot: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_hash?: string
          created_at?: string
          id?: string
          question?: string
          slot?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_security_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          assistant_enabled: boolean
          company_id: string
          created_at: string
          email: string
          email_notifications_enabled: boolean
          full_name: string | null
          id: string
          is_admin: boolean
          last_email_change_at: string | null
          mfa_required: boolean
          role: string
          send_test_tip_seen_at: string | null
          tutorials_seen_at: string | null
          updated_at: string
        }
        Insert: {
          assistant_enabled?: boolean
          company_id: string
          created_at?: string
          email: string
          email_notifications_enabled?: boolean
          full_name?: string | null
          id: string
          is_admin?: boolean
          last_email_change_at?: string | null
          mfa_required?: boolean
          role?: string
          send_test_tip_seen_at?: string | null
          tutorials_seen_at?: string | null
          updated_at?: string
        }
        Update: {
          assistant_enabled?: boolean
          company_id?: string
          created_at?: string
          email?: string
          email_notifications_enabled?: boolean
          full_name?: string | null
          id?: string
          is_admin?: boolean
          last_email_change_at?: string | null
          mfa_required?: boolean
          role?: string
          send_test_tip_seen_at?: string | null
          tutorials_seen_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_result: string | null
          provider: string
          received_at: string
          signature_verified: boolean
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_result?: string | null
          provider: string
          received_at?: string
          signature_verified: boolean
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_result?: string | null
          provider?: string
          received_at?: string
          signature_verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      subscription_events_audit_v1: {
        Row: {
          actor_user_id: string | null
          company_id: string | null
          created_at: string | null
          event_type: string | null
          from_plan_code: string | null
          from_status: string | null
          id: string | null
          notes: string | null
          to_plan_code: string | null
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type?: string | null
          from_plan_code?: string | null
          from_status?: string | null
          id?: string | null
          notes?: string | null
          to_plan_code?: string | null
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type?: string | null
          from_plan_code?: string | null
          from_status?: string | null
          id?: string | null
          notes?: string | null
          to_plan_code?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_company_storage: {
        Args: { p_company_id: string; p_delta_bytes: number }
        Returns: undefined
      }
      check_storage_quota: {
        Args: { p_company_id: string; p_file_size: number }
        Returns: boolean
      }
      claim_due_scheduled_messages: {
        Args: { p_limit?: number; p_stale_minutes?: number }
        Returns: {
          cancelled_reason: string | null
          claimed_at: string | null
          company_id: string
          created_at: string
          created_by_user_id: string
          failed_error: string | null
          fire_at: string
          fired_at: string | null
          id: string
          invoice_id: string | null
          order_id: string | null
          outbound_message_id: string | null
          pending_wait_days: number | null
          pending_wait_hours: number | null
          pending_wait_minutes: number | null
          quote_id: string | null
          recipient_email: string
          recipient_name: string | null
          require_no_response: boolean
          respect_quiet_hours: boolean
          status: string
          template_id: string | null
          trigger_anchor_at: string
          trigger_event: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      company_attachment_count: {
        Args: { p_company_id: string }
        Returns: number
      }
      company_catalog_count: { Args: { p_company_id: string }; Returns: number }
      company_component_count: {
        Args: { p_company_id: string }
        Returns: number
      }
      company_effective_plan_active: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      company_effective_plan_code: {
        Args: { p_company_id: string }
        Returns: string
      }
      company_flashing_count: {
        Args: { p_company_id: string }
        Returns: number
      }
      company_has_feature: {
        Args: { p_company_id: string; p_feature: string }
        Returns: boolean
      }
      company_invoice_count: { Args: { p_company_id: string }; Returns: number }
      company_order_count: { Args: { p_company_id: string }; Returns: number }
      consume_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_ms: number }
        Returns: boolean
      }
      create_invoice_atomic: {
        Args: { p_company_id: string; p_payload: Json; p_user_id: string }
        Returns: string
      }
      create_quote_atomic: {
        Args: { p_company_id: string; p_payload: Json; p_user_id: string }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      ensure_company_has_collection: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_next_quote_number: { Args: { p_company_id: string }; Returns: number }
      import_catalog_rows_atomic: {
        Args: {
          p_catalog_id: string
          p_company_id: string
          p_is_first: boolean
          p_is_last: boolean
          p_rows: Json
        }
        Returns: {
          data_bytes: number
          over_quota: boolean
          row_count: number
        }[]
      }
      increment_assistant_token_usage: {
        Args: {
          p_company_id: string
          p_month_key: string
          p_tokens: number
          p_usage_date: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_measurement_type_allowed_for_trade: {
        Args: { p_mtype: string; p_trade: string }
        Returns: boolean
      }
      match_doc_chunks: {
        Args: {
          filter_section?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          heading: string
          section: string
          similarity: number
          slug: string
        }[]
      }
      prune_rate_limits: { Args: never; Returns: number }
      reclaim_stale_dispatching_messages: {
        Args: { p_stale_minutes?: number }
        Returns: number
      }
      replace_customer_quote_lines: {
        Args: { p_company_id: string; p_lines: Json; p_quote_id: string }
        Returns: undefined
      }
      require_attachment_slot: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      require_catalog_slot: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      require_component_slot: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      require_flashing_slot: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      require_invoice_slot: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      require_order_slot: { Args: { p_company_id: string }; Returns: undefined }
      save_takeoff_atomic: {
        Args: { p_payload: Json; p_quote_id: string }
        Returns: undefined
      }
      search_catalog_rows: {
        Args: {
          p_catalog_id: string
          p_company_id: string
          p_limit?: number
          p_query: string
        }
        Returns: {
          catalog_id: string
          catalog_name: string
          id: string
          raw_row: Json
          row_index: number
          search_text: string
        }[]
      }
      seed_starter_components: {
        Args: { p_collection_id: string; p_company_id: string; p_rows: Json }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_belongs_to_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_status: "active" | "todo" | "archived"
      component_type: "main" | "extra"
      input_mode: "final" | "calculated"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "payment_reported"
        | "paid"
        | "disputed"
        | "cancelled"
      line_type: "component" | "custom" | "roof_area_header"
      measurement_system: "metric" | "imperial" | "imperial_ft" | "imperial_rs"
      measurement_type:
        | "area"
        | "linear"
        | "quantity"
        | "fixed"
        | "lineal"
        | "length_x_height"
        | "volume"
        | "hours_days"
        | "count"
        | "curved_line"
        | "irregular_area"
        | "multi_lineal"
        | "multi_lineal_lxh"
        | "volume_3d"
        | "length_x_height_freestyle"
        | "multi_lineal_lxh_freestyle"
      pitch_type: "none" | "rafter" | "valley_hip"
      pricing_strategy:
        | "per_unit"
        | "per_pack_length"
        | "per_pack_area"
        | "per_pack_coverage"
        | "per_pack_volume"
      quote_status:
        | "draft"
        | "confirmed"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
        | "archived"
      trade:
        | "roofing"
        | "generic"
        | "cladding"
        | "electrical"
        | "plumbing"
        | "landscaping"
        | "flooring"
        | "tiling"
        | "foundations"
        | "insulation"
        | "painting"
        | "fencing"
        | "concrete"
        | "construction"
        | "solar"
      waste_type: "percent" | "fixed" | "none" | "fixed_per_segment"
      waste_unit: "percent" | "flat" | "flat_per_segment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_status: ["active", "todo", "archived"],
      component_type: ["main", "extra"],
      input_mode: ["final", "calculated"],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "payment_reported",
        "paid",
        "disputed",
        "cancelled",
      ],
      line_type: ["component", "custom", "roof_area_header"],
      measurement_system: ["metric", "imperial", "imperial_ft", "imperial_rs"],
      measurement_type: [
        "area",
        "linear",
        "quantity",
        "fixed",
        "lineal",
        "length_x_height",
        "volume",
        "hours_days",
        "count",
        "curved_line",
        "irregular_area",
        "multi_lineal",
        "multi_lineal_lxh",
        "volume_3d",
        "length_x_height_freestyle",
        "multi_lineal_lxh_freestyle",
      ],
      pitch_type: ["none", "rafter", "valley_hip"],
      pricing_strategy: [
        "per_unit",
        "per_pack_length",
        "per_pack_area",
        "per_pack_coverage",
        "per_pack_volume",
      ],
      quote_status: [
        "draft",
        "confirmed",
        "sent",
        "accepted",
        "declined",
        "expired",
        "archived",
      ],
      trade: [
        "roofing",
        "generic",
        "cladding",
        "electrical",
        "plumbing",
        "landscaping",
        "flooring",
        "tiling",
        "foundations",
        "insulation",
        "painting",
        "fencing",
        "concrete",
        "construction",
        "solar",
      ],
      waste_type: ["percent", "fixed", "none", "fixed_per_segment"],
      waste_unit: ["percent", "flat", "flat_per_segment"],
    },
  },
} as const
