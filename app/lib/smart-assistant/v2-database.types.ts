/**
 * Narrow local schema extension for the DRAFT P0 migration.
 * Do not edit the generated/global Database file as part of this phase.
 * AGENT-TODO: after applying 20260924110000_sa_v2_p0_foundations.sql, regenerate
 * the canonical types in the integrating repo and compare these contracts.
 */
import type { Database, Json } from '@/app/lib/supabase/database.types';

export type PermissionStorageRow = {
  company_id: string;
  permissions: Json;
  revision: number;
  updated_at: string;
  updated_by: string | null;
};

export type PermissionRpcRow = {
  company_id: string;
  permissions: Json;
  revision: number;
  source: string;
  updated_at: string | null;
  can_manage: boolean;
};

export type AssistantV2Database = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      assistant_section_permissions: {
        Row: PermissionStorageRow;
        Insert: { company_id: string; permissions: Json; revision?: number; updated_at?: string; updated_by?: string | null };
        Update: { permissions?: Json; revision?: number; updated_at?: string; updated_by?: string | null };
        Relationships: [];
      };
    };
    Functions: Database['public']['Functions'] & {
      sa_v2_permissions_read: { Args: Record<string, never>; Returns: PermissionRpcRow[] };
      sa_v2_permissions_save: {
        Args: { p_permissions: Json; p_expected_revision: number; p_expected_company_id: string };
        Returns: PermissionRpcRow[];
      };
    };
  };
};
