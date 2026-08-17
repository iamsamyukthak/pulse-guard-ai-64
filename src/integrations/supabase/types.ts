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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          account_type: string
          avg_txn_amount: number
          balance: number
          created_at: string
          id: string
          status: string
          stddev_txn_amount: number
          user_id: string
        }
        Insert: {
          account_number: string
          account_type?: string
          avg_txn_amount?: number
          balance?: number
          created_at?: string
          id?: string
          status?: string
          stddev_txn_amount?: number
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: string
          avg_txn_amount?: number
          balance?: number
          created_at?: string
          id?: string
          status?: string
          stddev_txn_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      analyst_feedback: {
        Row: {
          analyst: string
          case_id: string | null
          created_at: string
          id: string
          label: string
          rationale: string
          transaction_id: string
        }
        Insert: {
          analyst?: string
          case_id?: string | null
          created_at?: string
          id?: string
          label: string
          rationale?: string
          transaction_id: string
        }
        Update: {
          analyst?: string
          case_id?: string | null
          created_at?: string
          id?: string
          label?: string
          rationale?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyst_feedback_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "investigation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyst_feedback_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      attack_scenarios: {
        Row: {
          description: string
          expected_decision: string
          id: string
          key: string
          name: string
          sort_order: number
          txn_count: number
        }
        Insert: {
          description: string
          expected_decision: string
          id?: string
          key: string
          name: string
          sort_order?: number
          txn_count?: number
        }
        Update: {
          description?: string
          expected_decision?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
          txn_count?: number
        }
        Relationships: []
      }
      devices: {
        Row: {
          browser: string
          fingerprint: string
          first_seen: string
          id: string
          is_emulator: boolean
          last_seen: string
          os: string
          trust_score: number
        }
        Insert: {
          browser?: string
          fingerprint: string
          first_seen?: string
          id?: string
          is_emulator?: boolean
          last_seen?: string
          os?: string
          trust_score?: number
        }
        Update: {
          browser?: string
          fingerprint?: string
          first_seen?: string
          id?: string
          is_emulator?: boolean
          last_seen?: string
          os?: string
          trust_score?: number
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          created_at: string
          description: string
          id: string
          severity: string
          status: string
          title: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          severity?: string
          status?: string
          title: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          severity?: string
          status?: string
          title?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_relationships: {
        Row: {
          created_at: string
          id: string
          relation: string
          source_id: string
          source_label: string
          source_type: string
          target_id: string
          target_label: string
          target_type: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          relation: string
          source_id: string
          source_label?: string
          source_type: string
          target_id: string
          target_label?: string
          target_type: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          relation?: string
          source_id?: string
          source_label?: string
          source_type?: string
          target_id?: string
          target_label?: string
          target_type?: string
          weight?: number
        }
        Relationships: []
      }
      investigation_cases: {
        Row: {
          alert_id: string | null
          assigned_to: string
          created_at: string
          id: string
          priority: string
          resolution: string | null
          status: string
          title: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          assigned_to?: string
          created_at?: string
          id?: string
          priority?: string
          resolution?: string | null
          status?: string
          title: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          assigned_to?: string
          created_at?: string
          id?: string
          priority?: string
          resolution?: string | null
          status?: string
          title?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_cases_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "fraud_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_cases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_notes: {
        Row: {
          author: string
          body: string
          case_id: string
          created_at: string
          id: string
        }
        Insert: {
          author?: string
          body: string
          case_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author?: string
          body?: string
          case_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "investigation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_addresses: {
        Row: {
          asn: string
          city: string
          country: string
          id: string
          ip: string
          is_proxy: boolean
          is_tor: boolean
          lat: number
          lon: number
          reputation: number
        }
        Insert: {
          asn?: string
          city?: string
          country?: string
          id?: string
          ip: string
          is_proxy?: boolean
          is_tor?: boolean
          lat?: number
          lon?: number
          reputation?: number
        }
        Update: {
          asn?: string
          city?: string
          country?: string
          id?: string
          ip?: string
          is_proxy?: boolean
          is_tor?: boolean
          lat?: number
          lon?: number
          reputation?: number
        }
        Relationships: []
      }
      merchants: {
        Row: {
          category: string
          country: string
          id: string
          mcc: string
          name: string
          risk_rating: number
        }
        Insert: {
          category: string
          country?: string
          id?: string
          mcc?: string
          name: string
          risk_rating?: number
        }
        Update: {
          category?: string
          country?: string
          id?: string
          mcc?: string
          name?: string
          risk_rating?: number
        }
        Relationships: []
      }
      risk_events: {
        Row: {
          category: string
          created_at: string
          detail: string
          id: string
          label: string
          rule_code: string
          transaction_id: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          detail?: string
          id?: string
          label: string
          rule_code: string
          transaction_id: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          detail?: string
          id?: string
          label?: string
          rule_code?: string
          transaction_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          created_at: string
          detail: string
          id: string
          metric_key: string
          metric_value: number
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          metric_key: string
          metric_value: number
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          metric_key?: string
          metric_value?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          anomaly_score: number
          channel: string
          created_at: string
          currency: string
          decision: string
          device_id: string | null
          explanation: string
          graph_score: number
          id: string
          ip_id: string | null
          merchant_id: string | null
          risk_score: number
          rule_score: number
          scenario_tag: string | null
          signals: Json
          status: string
        }
        Insert: {
          account_id: string
          amount: number
          anomaly_score?: number
          channel?: string
          created_at?: string
          currency?: string
          decision?: string
          device_id?: string | null
          explanation?: string
          graph_score?: number
          id?: string
          ip_id?: string | null
          merchant_id?: string | null
          risk_score?: number
          rule_score?: number
          scenario_tag?: string | null
          signals?: Json
          status?: string
        }
        Update: {
          account_id?: string
          amount?: number
          anomaly_score?: number
          channel?: string
          created_at?: string
          currency?: string
          decision?: string
          device_id?: string | null
          explanation?: string
          graph_score?: number
          id?: string
          ip_id?: string | null
          merchant_id?: string | null
          risk_score?: number
          rule_score?: number
          scenario_tag?: string | null
          signals?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ip_id_fkey"
            columns: ["ip_id"]
            isOneToOne: false
            referencedRelation: "ip_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          country: string
          created_at: string
          email: string
          full_name: string
          home_city: string
          home_lat: number
          home_lon: number
          id: string
          risk_tier: string
          signup_date: string
        }
        Insert: {
          country?: string
          created_at?: string
          email: string
          full_name: string
          home_city?: string
          home_lat?: number
          home_lon?: number
          id?: string
          risk_tier?: string
          signup_date?: string
        }
        Update: {
          country?: string
          created_at?: string
          email?: string
          full_name?: string
          home_city?: string
          home_lat?: number
          home_lon?: number
          id?: string
          risk_tier?: string
          signup_date?: string
        }
        Relationships: []
      }
      watchlist_entities: {
        Row: {
          added_at: string
          entity_type: string
          entity_value: string
          id: string
          reason: string
          severity: string
        }
        Insert: {
          added_at?: string
          entity_type: string
          entity_value: string
          id?: string
          reason?: string
          severity?: string
        }
        Update: {
          added_at?: string
          entity_type?: string
          entity_value?: string
          id?: string
          reason?: string
          severity?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
