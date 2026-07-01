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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          present: boolean | null
          rank: Database["public"]["Enums"]["rank"]
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string | null
        }
        Insert: {
          attendance_date: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          present?: boolean | null
          rank: Database["public"]["Enums"]["rank"]
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at?: string | null
        }
        Update: {
          attendance_date?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          present?: boolean | null
          rank?: Database["public"]["Enums"]["rank"]
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advances: {
        Row: {
          advance_date: string
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          advance_date: string
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          charge_jso: number
          charge_lso: number
          charge_oic: number
          charge_sso: number
          client_ot_rate: number
          company_name: string
          company_number: string | null
          created_at: string | null
          created_by: string | null
          id: string
          location: string
          pay_jso: number
          pay_lso: number
          pay_oic: number
          pay_sso: number
          updated_at: string | null
        }
        Insert: {
          charge_jso?: number
          charge_lso?: number
          charge_oic?: number
          charge_sso?: number
          client_ot_rate?: number
          company_name: string
          company_number?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location: string
          pay_jso: number
          pay_lso: number
          pay_oic: number
          pay_sso: number
          updated_at?: string | null
        }
        Update: {
          charge_jso?: number
          charge_lso?: number
          charge_oic?: number
          charge_sso?: number
          client_ot_rate?: number
          company_name?: string
          company_number?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: string
          pay_jso?: number
          pay_lso?: number
          pay_oic?: number
          pay_sso?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          account_number: string
          bank_name: string
          branch: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          epf_no: string | null
          extended_ot_hours: number
          full_name: string
          id: string
          nic: string
          normal_ot_hours: number
          ot_hourly_rate: number
          phone_number: string
          updated_at: string | null
        }
        Insert: {
          account_number: string
          bank_name: string
          branch: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          epf_no?: string | null
          extended_ot_hours?: number
          full_name: string
          id?: string
          nic: string
          normal_ot_hours?: number
          ot_hourly_rate?: number
          phone_number: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string
          bank_name?: string
          branch?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          epf_no?: string | null
          extended_ot_hours?: number
          full_name?: string
          id?: string
          nic?: string
          normal_ot_hours?: number
          ot_hourly_rate?: number
          phone_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          invoice_ref: string | null
          is_paid: boolean
          payment_date: string | null
          subcategory: string | null
          supplier: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date: string
          id?: string
          invoice_ref?: string | null
          is_paid?: boolean
          payment_date?: string | null
          subcategory?: string | null
          supplier?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          invoice_ref?: string | null
          is_paid?: boolean
          payment_date?: string | null
          subcategory?: string | null
          supplier?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      food_advances: {
        Row: {
          advance_date: string
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          advance_date: string
          amount: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          color: string | null
          created_at: string
          created_by: string | null
          epaulet_rank: string | null
          gender: string | null
          id: string
          item_name: string
          notes: string | null
          quantity: number
          size: string | null
          supplier: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          epaulet_rank?: string | null
          gender?: string | null
          id?: string
          item_name: string
          notes?: string | null
          quantity?: number
          size?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          epaulet_rank?: string | null
          gender?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          size?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          change: number
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          item_id: string
          moved_at: string
          reason: string | null
          reference: string | null
        }
        Insert: {
          change: number
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          item_id: string
          moved_at?: string
          reason?: string | null
          reference?: string | null
        }
        Update: {
          change?: number
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          item_id?: string
          moved_at?: string
          reason?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          reference_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_received: number
          amount_to_collect: number
          company_id: string
          created_at: string
          created_by: string | null
          emailed: boolean
          id: string
          invoice_data: Json | null
          invoice_date: string
          invoice_number: string
          invoice_sent: boolean
          month_period: string
          printed: boolean
          updated_at: string
        }
        Insert: {
          amount_received?: number
          amount_to_collect?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          emailed?: boolean
          id?: string
          invoice_data?: Json | null
          invoice_date?: string
          invoice_number: string
          invoice_sent?: boolean
          month_period: string
          printed?: boolean
          updated_at?: string
        }
        Update: {
          amount_received?: number
          amount_to_collect?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          emailed?: boolean
          id?: string
          invoice_data?: Json | null
          invoice_date?: string
          invoice_number?: string
          invoice_sent?: boolean
          month_period?: string
          printed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_entries: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string
          hours: number
          id: string
          ot_date: string
          ot_rate: number
          reason: string
          start_time: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_time: string
          hours: number
          id?: string
          ot_date: string
          ot_rate: number
          reason: string
          start_time: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_time?: string
          hours?: number
          id?: string
          ot_date?: string
          ot_rate?: number
          reason?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          basic_salary: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          employee_id: string
          epf: number | null
          final_salary: number | null
          food: number | null
          gross_shift_total: number | null
          id: string
          other_deductions: number | null
          pay_per_shift: number | null
          salary_advance: number | null
          salary_advance_2: number
          salary_month: string
          total_shifts: number | null
          transport: number | null
          uniforms: number | null
          updated_at: string | null
        }
        Insert: {
          basic_salary?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          epf?: number | null
          final_salary?: number | null
          food?: number | null
          gross_shift_total?: number | null
          id?: string
          other_deductions?: number | null
          pay_per_shift?: number | null
          salary_advance?: number | null
          salary_advance_2?: number
          salary_month: string
          total_shifts?: number | null
          transport?: number | null
          uniforms?: number | null
          updated_at?: string | null
        }
        Update: {
          basic_salary?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          epf?: number | null
          final_salary?: number | null
          food?: number | null
          gross_shift_total?: number | null
          id?: string
          other_deductions?: number | null
          pay_per_shift?: number | null
          salary_advance?: number | null
          salary_advance_2?: number
          salary_month?: string
          total_shifts?: number | null
          transport?: number | null
          uniforms?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      uniform_advances: {
        Row: {
          advance_date: string
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          advance_date: string
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uniform_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniform_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_access: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      employees_limited: {
        Row: {
          created_at: string | null
          employee_id: string | null
          full_name: string | null
          id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_office: { Args: { _user_id: string }; Returns: boolean }
      is_regular_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "user"
        | "moderator"
        | "viewer"
        | "office"
      rank: "OIC" | "SSO" | "JSO" | "LSO"
      shift_type: "Day" | "Night"
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
      app_role: [
        "super_admin",
        "admin",
        "user",
        "moderator",
        "viewer",
        "office",
      ],
      rank: ["OIC", "SSO", "JSO", "LSO"],
      shift_type: ["Day", "Night"],
    },
  },
} as const
