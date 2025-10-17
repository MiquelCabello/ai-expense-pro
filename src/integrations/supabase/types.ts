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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_departments: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_departments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          can_add_custom_categories: boolean
          can_assign_department: boolean
          can_assign_region: boolean
          can_assign_roles: boolean
          created_at: string
          department_admin_limit: number | null
          global_admin_limit: number | null
          id: string
          max_employees: number | null
          monthly_expense_limit: number | null
          name: string
          owner_user_id: string
          plan: Database["public"]["Enums"]["account_plan"]
          updated_at: string
        }
        Insert: {
          can_add_custom_categories?: boolean
          can_assign_department?: boolean
          can_assign_region?: boolean
          can_assign_roles?: boolean
          created_at?: string
          department_admin_limit?: number | null
          global_admin_limit?: number | null
          id?: string
          max_employees?: number | null
          monthly_expense_limit?: number | null
          name: string
          owner_user_id: string
          plan?: Database["public"]["Enums"]["account_plan"]
          updated_at?: string
        }
        Update: {
          can_add_custom_categories?: boolean
          can_assign_department?: boolean
          can_assign_region?: boolean
          can_assign_roles?: boolean
          created_at?: string
          department_admin_limit?: number | null
          global_admin_limit?: number | null
          id?: string
          max_employees?: number | null
          monthly_expense_limit?: number | null
          name?: string
          owner_user_id?: string
          plan?: Database["public"]["Enums"]["account_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          account_id: string | null
          action: string
          actor_user_id: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_user_id: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_user_id?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          account_id: string | null
          budget_monthly: number | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          budget_monthly?: number | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          budget_monthly?: number | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          category_limit: number | null
          city: string | null
          created_at: string
          department_admin_limit: number | null
          description: string | null
          email: string | null
          global_admin_limit: number | null
          id: string
          logo_url: string | null
          max_employees: number | null
          migrated_from_account_id: string | null
          migration_status: string | null
          monthly_expense_limit: number | null
          name: string
          owner_user_id: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          postal_code: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category_limit?: number | null
          city?: string | null
          created_at?: string
          department_admin_limit?: number | null
          description?: string | null
          email?: string | null
          global_admin_limit?: number | null
          id?: string
          logo_url?: string | null
          max_employees?: number | null
          migrated_from_account_id?: string | null
          migration_status?: string | null
          monthly_expense_limit?: number | null
          name: string
          owner_user_id: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category_limit?: number | null
          city?: string | null
          created_at?: string
          department_admin_limit?: number | null
          description?: string | null
          email?: string | null
          global_admin_limit?: number | null
          id?: string
          logo_url?: string | null
          max_employees?: number | null
          migrated_from_account_id?: string | null
          migration_status?: string | null
          monthly_expense_limit?: number | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          migrated_from_account_department_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          migrated_from_account_department_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          migrated_from_account_department_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "user_permissions_dual"
            referencedColumns: ["company_id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string | null
          amount_gross: number
          amount_net: number
          approved_at: string | null
          approver_id: string | null
          category_id: string
          classification_path: string | null
          created_at: string
          currency: string
          doc_type: Database["public"]["Enums"]["expense_doc_type"] | null
          doc_type_source:
            | Database["public"]["Enums"]["classification_source"]
            | null
          employee_id: string
          expense_date: string
          hash_dedupe: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          project_code_id: string | null
          receipt_file_id: string | null
          rejection_reason: string | null
          source: Database["public"]["Enums"]["expense_source"]
          status: Database["public"]["Enums"]["expense_status"]
          tax_vat: number | null
          updated_at: string
          user_id: string | null
          vendor: string
        }
        Insert: {
          account_id?: string | null
          amount_gross: number
          amount_net: number
          approved_at?: string | null
          approver_id?: string | null
          category_id: string
          classification_path?: string | null
          created_at?: string
          currency?: string
          doc_type?: Database["public"]["Enums"]["expense_doc_type"] | null
          doc_type_source?:
            | Database["public"]["Enums"]["classification_source"]
            | null
          employee_id: string
          expense_date: string
          hash_dedupe: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          project_code_id?: string | null
          receipt_file_id?: string | null
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          status?: Database["public"]["Enums"]["expense_status"]
          tax_vat?: number | null
          updated_at?: string
          user_id?: string | null
          vendor: string
        }
        Update: {
          account_id?: string | null
          amount_gross?: number
          amount_net?: number
          approved_at?: string | null
          approver_id?: string | null
          category_id?: string
          classification_path?: string | null
          created_at?: string
          currency?: string
          doc_type?: Database["public"]["Enums"]["expense_doc_type"] | null
          doc_type_source?:
            | Database["public"]["Enums"]["classification_source"]
            | null
          employee_id?: string
          expense_date?: string
          hash_dedupe?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          project_code_id?: string | null
          receipt_file_id?: string | null
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          status?: Database["public"]["Enums"]["expense_status"]
          tax_vat?: number | null
          updated_at?: string
          user_id?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_code_id_fkey"
            columns: ["project_code_id"]
            isOneToOne: false
            referencedRelation: "project_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "receipt_files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          account_id: string | null
          checksum_sha256: string
          created_at: string
          id: string
          metadata: Json | null
          mime_type: string
          original_name: string
          size_bytes: number
          storage_key: string
          uploaded_by: string
        }
        Insert: {
          account_id?: string | null
          checksum_sha256: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mime_type: string
          original_name: string
          size_bytes: number
          storage_key: string
          uploaded_by: string
        }
        Update: {
          account_id?: string | null
          checksum_sha256?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_key?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          department: string | null
          email: string
          expires_at: string | null
          id: string
          name: string
          region: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          department?: string | null
          email: string
          expires_at?: string | null
          id?: string
          name: string
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          department?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          name?: string
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          migrated_from_profile_id: string | null
          migrated_from_user_role_id: string | null
          role: Database["public"]["Enums"]["role_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          migrated_from_profile_id?: string | null
          migrated_from_user_role_id?: string | null
          role: Database["public"]["Enums"]["role_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          migrated_from_profile_id?: string | null
          migrated_from_user_role_id?: string | null
          role?: Database["public"]["Enums"]["role_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "user_permissions_dual"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "memberships_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          created_at: string
          department: string | null
          department_id: string | null
          id: string
          name: string
          region: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          id?: string
          name: string
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          id?: string
          name?: string
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "account_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_v2: {
        Row: {
          created_at: string
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_codes: {
        Row: {
          account_id: string | null
          code: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      receipt_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          original_name: string | null
          path: string
          size: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          path: string
          size?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          path?: string
          size?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "account_departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      migration_status_detailed: {
        Row: {
          entidad: string | null
          migrados: number | null
          porcentaje_completado: number | null
          total_original: number | null
        }
        Relationships: []
      }
      migration_status_v1: {
        Row: {
          migrated_count: number | null
          migration: string | null
          pending_count: number | null
          total_original: number | null
        }
        Relationships: []
      }
      user_permissions_dual: {
        Row: {
          company_id: string | null
          company_name: string | null
          current_user_id: string | null
          has_company_scope: boolean | null
          is_master: boolean | null
          is_member: boolean | null
          role_new_system: Database["public"]["Enums"]["role_type"] | null
          role_old_system: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_plan_limits: {
        Args: { _account_id: string; _limit_type: string }
        Returns: number
      }
      check_user_role: {
        Args: {
          _account_id: string
          _role: Database["public"]["Enums"]["user_role_type"]
          _user_id: string
        }
        Returns: boolean
      }
      company_plan_dual: {
        Args: { target_company: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      current_postgres_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      effective_category_limit_dual: {
        Args: { target_company: string }
        Returns: number
      }
      get_account_id: {
        Args: { _uid: string }
        Returns: string
      }
      get_account_plan: {
        Args: { _account_id: string }
        Returns: Database["public"]["Enums"]["account_plan"]
      }
      get_admin_count_for_account: {
        Args: { p_account_id: string }
        Returns: number
      }
      get_company_from_account: {
        Args: { account_uuid: string }
        Returns: string
      }
      get_migration_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          migrated_count: number
          migration: string
          pending_count: number
          total_original: number
        }[]
      }
      get_user_department: {
        Args: { _account_id: string; _user_id: string }
        Returns: string
      }
      get_user_email: {
        Args: { target_user_id: string }
        Returns: string
      }
      get_user_role_dual: {
        Args: { target_company: string; target_user_id: string }
        Returns: Database["public"]["Enums"]["role_type"]
      }
      has_company_scope_dual: {
        Args: { target_company: string }
        Returns: boolean
      }
      has_department_scope_dual: {
        Args: { target_company: string; target_department: string }
        Returns: boolean
      }
      has_dual_access_to_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_account_admin: {
        Args: { _uid: string }
        Returns: boolean
      }
      is_admin: {
        Args: { _uid: string }
        Returns: boolean
      }
      is_admin_legacy: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_any_admin: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_employee_dual: {
        Args: { target_company: string }
        Returns: boolean
      }
      is_leaked_password_protection_enabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_master_dual: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_master_user: {
        Args: { _email: string } | { _uid: string }
        Returns: boolean
      }
      is_member_of_company_dual: {
        Args: { target_company: string }
        Returns: boolean
      }
      plan_settings: {
        Args: { _plan: Database["public"]["Enums"]["account_plan"] }
        Returns: {
          can_add_custom_categories: boolean
          can_assign_department: boolean
          can_assign_region: boolean
          can_assign_roles: boolean
          max_employees: number
          monthly_expense_limit: number
        }[]
      }
    }
    Enums: {
      account_plan: "FREE" | "PROFESSIONAL" | "ENTERPRISE"
      classification_source: "ai" | "user" | "db-fallback"
      expense_doc_type: "ticket" | "invoice"
      expense_source: "MANUAL" | "AI_EXTRACTED"
      expense_status: "PENDING" | "APPROVED" | "REJECTED"
      payment_method: "CARD" | "CASH" | "TRANSFER" | "OTHER"
      plan_tier: "free" | "pro" | "enterprise"
      project_status: "ACTIVE" | "INACTIVE"
      role_type:
        | "owner"
        | "employee"
        | "company_admin"
        | "department_admin"
        | "global_admin"
      user_role: "ADMIN" | "EMPLOYEE" | "DEPARTMENT_ADMIN"
      user_role_type:
        | "account_owner"
        | "account_admin"
        | "department_admin"
        | "employee"
      user_status: "ACTIVE" | "INACTIVE"
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
      account_plan: ["FREE", "PROFESSIONAL", "ENTERPRISE"],
      classification_source: ["ai", "user", "db-fallback"],
      expense_doc_type: ["ticket", "invoice"],
      expense_source: ["MANUAL", "AI_EXTRACTED"],
      expense_status: ["PENDING", "APPROVED", "REJECTED"],
      payment_method: ["CARD", "CASH", "TRANSFER", "OTHER"],
      plan_tier: ["free", "pro", "enterprise"],
      project_status: ["ACTIVE", "INACTIVE"],
      role_type: [
        "owner",
        "employee",
        "company_admin",
        "department_admin",
        "global_admin",
      ],
      user_role: ["ADMIN", "EMPLOYEE", "DEPARTMENT_ADMIN"],
      user_role_type: [
        "account_owner",
        "account_admin",
        "department_admin",
        "employee",
      ],
      user_status: ["ACTIVE", "INACTIVE"],
    },
  },
} as const
