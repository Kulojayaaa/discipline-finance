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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          opening_balance: number | null
          type: Database["public"]["Enums"]["account_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          opening_balance?: number | null
          type?: Database["public"]["Enums"]["account_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          opening_balance?: number | null
          type?: Database["public"]["Enums"]["account_type"] | null
          user_id?: string
        }
        Relationships: []
      }
      bills_reminders: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          due_date: string
          frequency: Database["public"]["Enums"]["bill_frequency"] | null
          id: string
          is_paid: boolean | null
          is_recurring: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          due_date: string
          frequency?: Database["public"]["Enums"]["bill_frequency"] | null
          id?: string
          is_paid?: boolean | null
          is_recurring?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          due_date?: string
          frequency?: Database["public"]["Enums"]["bill_frequency"] | null
          id?: string
          is_paid?: boolean | null
          is_recurring?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_reminders_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          month: string
          planned_amount: number
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          month: string
          planned_amount: number
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          month?: string
          planned_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_tracker: {
        Row: {
          borrowed_amount: number | null
          created_at: string | null
          id: string
          month: string
          opening_balance: number | null
          paid_amount: number | null
          user_id: string
        }
        Insert: {
          borrowed_amount?: number | null
          created_at?: string | null
          id?: string
          month: string
          opening_balance?: number | null
          paid_amount?: number | null
          user_id: string
        }
        Update: {
          borrowed_amount?: number | null
          created_at?: string | null
          id?: string
          month?: string
          opening_balance?: number | null
          paid_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      emi_payments: {
        Row: {
          amount: number
          created_at: string | null
          emi_id: string
          id: string
          payment_date: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          emi_id: string
          id?: string
          payment_date?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          emi_id?: string
          id?: string
          payment_date?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emi_payments_emi_id_fkey"
            columns: ["emi_id"]
            isOneToOne: false
            referencedRelation: "emi_tracker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emi_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      emi_tracker: {
        Row: {
          created_at: string | null
          emi_amount: number
          id: string
          interest_rate: number
          name: string
          principal: number
          start_date: string
          status: Database["public"]["Enums"]["emi_status"] | null
          tenure_months: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emi_amount: number
          id?: string
          interest_rate: number
          name: string
          principal: number
          start_date: string
          status?: Database["public"]["Enums"]["emi_status"] | null
          tenure_months: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          emi_amount?: number
          id?: string
          interest_rate?: number
          name?: string
          principal?: number
          start_date?: string
          status?: Database["public"]["Enums"]["emi_status"] | null
          tenure_months?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          currency: string | null
          daily_spending_limit: number | null
          display_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          daily_spending_limit?: number | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          daily_spending_limit?: number | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          id: string
          name: string
          target_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          id?: string
          name: string
          target_amount: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          id?: string
          name?: string
          target_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string | null
          date: string
          id: string
          linked_emi_id: string | null
          note: string | null
          spender_type: Database["public"]["Enums"]["spender_type"] | null
          transfer_to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          linked_emi_id?: string | null
          note?: string | null
          spender_type?: Database["public"]["Enums"]["spender_type"] | null
          transfer_to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          linked_emi_id?: string | null
          note?: string | null
          spender_type?: Database["public"]["Enums"]["spender_type"] | null
          transfer_to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_emi"
            columns: ["linked_emi_id"]
            isOneToOne: false
            referencedRelation: "emi_tracker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_to_account_id_fkey"
            columns: ["transfer_to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "cash" | "bank" | "wallet" | "credit"
      bill_frequency: "daily" | "weekly" | "monthly" | "yearly"
      emi_status: "active" | "completed" | "defaulted"
      spender_type: "self" | "family"
      transaction_type: "income" | "expense" | "transfer"
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
      account_type: ["cash", "bank", "wallet", "credit"],
      bill_frequency: ["daily", "weekly", "monthly", "yearly"],
      emi_status: ["active", "completed", "defaulted"],
      spender_type: ["self", "family"],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
