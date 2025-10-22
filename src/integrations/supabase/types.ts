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
      account_memberships: {
        Row: {
          account_id: string
          created_at: string
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
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
          company_id: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          budget_monthly?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          budget_monthly?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          account_id: string | null
          address: string | null
          category_limit: number | null
          city: string | null
          created_at: string
          department_admin_limit: number | null
          description: string | null
          email: string | null
          global_admin_limit: number | null
          id: string
          logo_file_id: string | null
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
          account_id?: string | null
          address?: string | null
          category_limit?: number | null
          city?: string | null
          created_at?: string
          department_admin_limit?: number | null
          description?: string | null
          email?: string | null
          global_admin_limit?: number | null
          id?: string
          logo_file_id?: string | null
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
          account_id?: string | null
          address?: string | null
          category_limit?: number | null
          city?: string | null
          created_at?: string
          department_admin_limit?: number | null
          description?: string | null
          email?: string | null
          global_admin_limit?: number | null
          id?: string
          logo_file_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "companies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          currency: string | null
          extra: Json | null
          locale: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          currency?: string | null
          extra?: Json | null
          locale?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          currency?: string | null
          extra?: Json | null
          locale?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_key?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["role_company"]
          token: string
          used_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["role_company"]
          token: string
          used_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["role_company"]
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          migrated_from_profile_id: string | null
          migrated_from_user_role_id: string | null
          role: Database["public"]["Enums"]["role_company"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          migrated_from_profile_id?: string | null
          migrated_from_user_role_id?: string | null
          role?: Database["public"]["Enums"]["role_company"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          migrated_from_profile_id?: string | null
          migrated_from_user_role_id?: string | null
          role?: Database["public"]["Enums"]["role_company"] | null
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
            foreignKeyName: "memberships_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_v2: {
        Row: {
          avatar_file_id: string | null
          created_at: string
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_file_id?: string | null
          created_at?: string
          email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_file_id?: string | null
          created_at?: string
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_v2_avatar_file_id_fkey"
            columns: ["avatar_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      project_codes: {
        Row: {
          account_id: string | null
          code: string
          company_id: string | null
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      get_user_email: {
        Args: { target_user_id: string }
        Returns: string
      }
      get_user_role_dual: {
        Args: { target_company: string; target_user_id: string }
        Returns: Database["public"]["Enums"]["role_type"]
      }
      has_company_role: {
        Args: { c_id: string; roles: string[] }
        Returns: boolean
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
      is_account_owner: {
        Args: { a_id: string }
        Returns: boolean
      }
      is_employee_dual: {
        Args: { target_company: string }
        Returns: boolean
      }
      is_global_admin: {
        Args: Record<PropertyKey, never>
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
      my_department_id: {
        Args: { c_id: string }
        Returns: string
      }
      set_safe_search_path: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      account_role: "account_owner"
      classification_source: "ai" | "user" | "db-fallback"
      expense_doc_type: "ticket" | "invoice"
      expense_source: "MANUAL" | "AI_EXTRACTED"
      expense_status: "PENDING" | "APPROVED" | "REJECTED"
      payment_method: "CARD" | "CASH" | "TRANSFER" | "OTHER"
      plan_tier: "free" | "pro" | "enterprise"
      project_status: "ACTIVE" | "INACTIVE"
      role_company: "owner" | "company_admin" | "department_admin" | "employee"
      role_type:
        | "owner"
        | "employee"
        | "company_admin"
        | "department_admin"
        | "global_admin"
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
      account_role: ["account_owner"],
      classification_source: ["ai", "user", "db-fallback"],
      expense_doc_type: ["ticket", "invoice"],
      expense_source: ["MANUAL", "AI_EXTRACTED"],
      expense_status: ["PENDING", "APPROVED", "REJECTED"],
      payment_method: ["CARD", "CASH", "TRANSFER", "OTHER"],
      plan_tier: ["free", "pro", "enterprise"],
      project_status: ["ACTIVE", "INACTIVE"],
      role_company: ["owner", "company_admin", "department_admin", "employee"],
      role_type: [
        "owner",
        "employee",
        "company_admin",
        "department_admin",
        "global_admin",
      ],
    },
  },
} as const
