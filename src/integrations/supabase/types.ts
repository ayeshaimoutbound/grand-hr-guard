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
      assets: {
        Row: {
          asset_category: string
          asset_name: string
          assigned_to: string | null
          condition: string
          created_at: string
          created_by: string | null
          id: string
          identifier: string | null
          invoice_ref: string | null
          location: string | null
          notes: string | null
          purchase_cost: number
          purchase_date: string | null
          quantity: number
          serial_number: string | null
          status: string
          updated_at: string
          vehicle_number: string | null
          vendor_id: string | null
        }
        Insert: {
          asset_category: string
          asset_name: string
          assigned_to?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          identifier?: string | null
          invoice_ref?: string | null
          location?: string | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          quantity?: number
          serial_number?: string | null
          status?: string
          updated_at?: string
          vehicle_number?: string | null
          vendor_id?: string | null
        }
        Update: {
          asset_category?: string
          asset_name?: string
          assigned_to?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          identifier?: string | null
          invoice_ref?: string | null
          location?: string | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          quantity?: number
          serial_number?: string | null
          status?: string
          updated_at?: string
          vehicle_number?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
          active_ranks: string[]
          archived: boolean
          archived_at: string | null
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
          active_ranks?: string[]
          archived?: boolean
          archived_at?: string | null
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
          active_ranks?: string[]
          archived?: boolean
          archived_at?: string | null
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
      food_charges: {
        Row: {
          breakfast_count: number
          breakfast_rate: number
          company_id: string | null
          created_at: string
          created_by: string | null
          dinner_count: number
          dinner_rate: number
          employee_id: string
          id: string
          location: string | null
          lunch_count: number
          lunch_rate: number
          manual_entry: boolean
          month: string
          notes: string | null
          total_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          breakfast_count?: number
          breakfast_rate?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dinner_count?: number
          dinner_rate?: number
          employee_id: string
          id?: string
          location?: string | null
          lunch_count?: number
          lunch_rate?: number
          manual_entry?: boolean
          month: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          breakfast_count?: number
          breakfast_rate?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dinner_count?: number
          dinner_rate?: number
          employee_id?: string
          id?: string
          location?: string | null
          lunch_count?: number
          lunch_rate?: number
          manual_entry?: boolean
          month?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_charges_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_charges_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_charges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "food_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      food_rates: {
        Row: {
          breakfast_rate: number
          company_id: string | null
          created_at: string
          created_by: string | null
          dinner_rate: number
          effective_from: string
          id: string
          location: string | null
          lunch_rate: number
          updated_at: string
        }
        Insert: {
          breakfast_rate?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dinner_rate?: number
          effective_from?: string
          id?: string
          location?: string | null
          lunch_rate?: number
          updated_at?: string
        }
        Update: {
          breakfast_rate?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dinner_rate?: number
          effective_from?: string
          id?: string
          location?: string | null
          lunch_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      food_vendors: {
        Row: {
          company_id: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          updated_at: string
          vendor_name: string
        }
        Insert: {
          company_id?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          vendor_name: string
        }
        Update: {
          company_id?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          auto_threshold: boolean
          category: string
          color: string | null
          created_at: string
          created_by: string | null
          epaulet_rank: string | null
          gender: string | null
          id: string
          inventory_type: string
          item_name: string
          low_stock_threshold: number
          notes: string | null
          quantity: number
          size: string | null
          supplier: string | null
          unit_cost: number | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          auto_threshold?: boolean
          category: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          epaulet_rank?: string | null
          gender?: string | null
          id?: string
          inventory_type?: string
          item_name: string
          low_stock_threshold?: number
          notes?: string | null
          quantity?: number
          size?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          auto_threshold?: boolean
          category?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          epaulet_rank?: string | null
          gender?: string | null
          id?: string
          inventory_type?: string
          item_name?: string
          low_stock_threshold?: number
          notes?: string | null
          quantity?: number
          size?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          batch_id: string | null
          change: number
          created_at: string
          created_by: string | null
          employee_id: string | null
          expense_id: string | null
          id: string
          item_id: string
          moved_at: string
          reason: string | null
          reference: string | null
          unit_cost: number | null
        }
        Insert: {
          batch_id?: string | null
          change: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          expense_id?: string | null
          id?: string
          item_id: string
          moved_at?: string
          reason?: string | null
          reference?: string | null
          unit_cost?: number | null
        }
        Update: {
          batch_id?: string | null
          change?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          expense_id?: string | null
          id?: string
          item_id?: string
          moved_at?: string
          reason?: string | null
          reference?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "uniform_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_limited"
            referencedColumns: ["id"]
          },
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
      inventory_purchases: {
        Row: {
          batch_id: string | null
          cheque_date: string | null
          cheque_number: string | null
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          invoice_ref: string | null
          is_paid: boolean
          item_id: string | null
          notes: string | null
          payment_method: string | null
          purchase_date: string
          quantity: number
          total_amount: number
          unit_cost: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          batch_id?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          invoice_ref?: string | null
          is_paid?: boolean
          item_id?: string | null
          notes?: string | null
          payment_method?: string | null
          purchase_date?: string
          quantity?: number
          total_amount?: number
          unit_cost?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          batch_id?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          invoice_ref?: string | null
          is_paid?: boolean
          item_id?: string | null
          notes?: string | null
          payment_method?: string | null
          purchase_date?: string
          quantity?: number
          total_amount?: number
          unit_cost?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchases_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "uniform_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
      maintenance_records: {
        Row: {
          asset_name: string | null
          cheque_date: string | null
          cheque_number: string | null
          cost: number
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          invoice_ref: string | null
          is_paid: boolean
          maintenance_type: string
          next_service_date: string | null
          notes: string | null
          payment_method: string | null
          service_date: string
          status: string
          title: string
          updated_at: string
          vehicle_number: string | null
          vendor_id: string | null
        }
        Insert: {
          asset_name?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          invoice_ref?: string | null
          is_paid?: boolean
          maintenance_type?: string
          next_service_date?: string | null
          notes?: string | null
          payment_method?: string | null
          service_date?: string
          status?: string
          title: string
          updated_at?: string
          vehicle_number?: string | null
          vendor_id?: string | null
        }
        Update: {
          asset_name?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          invoice_ref?: string | null
          is_paid?: boolean
          maintenance_type?: string
          next_service_date?: string | null
          notes?: string | null
          payment_method?: string | null
          service_date?: string
          status?: string
          title?: string
          updated_at?: string
          vehicle_number?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          is_paid: boolean
          other_deductions: number | null
          paid_at: string | null
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
          is_paid?: boolean
          other_deductions?: number | null
          paid_at?: string | null
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
          is_paid?: boolean
          other_deductions?: number | null
          paid_at?: string | null
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
      salary_manual_deductions: {
        Row: {
          accommodation: number
          created_at: string
          employee_id: string
          food: number
          id: string
          notes: string | null
          other: number
          salary_month: string
          transport: number
          uniforms: number
          updated_at: string
        }
        Insert: {
          accommodation?: number
          created_at?: string
          employee_id: string
          food?: number
          id?: string
          notes?: string | null
          other?: number
          salary_month: string
          transport?: number
          uniforms?: number
          updated_at?: string
        }
        Update: {
          accommodation?: number
          created_at?: string
          employee_id?: string
          food?: number
          id?: string
          notes?: string | null
          other?: number
          salary_month?: string
          transport?: number
          uniforms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_manual_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_manual_deductions_employee_id_fkey"
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
          batch_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          installment_index: number
          installment_months: number
          notes: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          advance_date: string
          amount: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          installment_index?: number
          installment_months?: number
          notes?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          installment_index?: number
          installment_months?: number
          notes?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uniform_advances_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "uniform_batches"
            referencedColumns: ["id"]
          },
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
      uniform_batches: {
        Row: {
          batch_number: string
          created_at: string
          created_by: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          notes: string | null
          supplier: string | null
          updated_at: string
          upload_date: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          supplier?: string | null
          updated_at?: string
          upload_date?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          supplier?: string | null
          updated_at?: string
          upload_date?: string
        }
        Relationships: []
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
      vendors: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          branch_name: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          vendor_name: string
          vendor_type: string
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          branch_name?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vendor_name: string
          vendor_type?: string
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          branch_name?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vendor_name?: string
          vendor_type?: string
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
      next_uniform_batch_number: { Args: never; Returns: string }
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
