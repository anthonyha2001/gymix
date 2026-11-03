
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "checkins": {
                  Row: {
                    "allowed": boolean,"checked_in_at": string,"checked_in_by": string | null,"gym_id": string,"id": string,"member_id": string,"membership_id": string | null,"reason": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed": boolean,"checked_in_at"?: string,"checked_in_by"?: string | null,"gym_id": string,"id"?: string,"member_id": string,"membership_id"?: string | null,"reason"?: string | null,"source"?: string
                  }
                  Update: {
                    "allowed"?: boolean,"checked_in_at"?: string,"checked_in_by"?: string | null,"gym_id"?: string,"id"?: string,"member_id"?: string,"membership_id"?: string | null,"reason"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_checked_in_by_fkey"
      columns: ["checked_in_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "checkins_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"gym_users": {
                  Row: {
                    "created_at": string,"gym_id": string,"role": Database["public"]['Enums']["gym_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gym_id": string,"role": Database["public"]['Enums']["gym_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"gym_id"?: string,"role"?: Database["public"]['Enums']["gym_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gym_users_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gym_users_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"gyms": {
                  Row: {
                    "checkin_token": string,"created_at": string,"created_by": string | null,"id": string,"lbp_rate": number,"name": string,"next_invoice_number": number,"slug": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_token"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lbp_rate"?: number,"name": string,"next_invoice_number"?: number,"slug": string,"timezone"?: string
                  }
                  Update: {
                    "checkin_token"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lbp_rate"?: number,"name"?: string,"next_invoice_number"?: number,"slug"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"gym_id": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["gym_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"gym_id": string,"id"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["gym_role"]
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"gym_id"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["gym_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_usd": number,"created_at": string,"created_by": string | null,"description": string,"discount_usd": number,"gym_id": string,"id": string,"issued_on": string,"member_id": string,"membership_id": string | null,"number": number,"void_reason": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_usd": number,"created_at"?: string,"created_by"?: string | null,"description": string,"discount_usd"?: number,"gym_id": string,"id"?: string,"issued_on": string,"member_id": string,"membership_id"?: string | null,"number": number,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_usd"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string,"discount_usd"?: number,"gym_id"?: string,"id"?: string,"issued_on"?: string,"member_id"?: string,"membership_id"?: string | null,"number"?: number,"void_reason"?: string | null,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "invoices_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "checkin_code": string,"created_at": string,"created_by": string | null,"email": string | null,"full_name": string,"gym_id": string,"id": string,"notes": string | null,"phone": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_code"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name": string,"gym_id": string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "checkin_code"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name"?: string,"gym_id"?: string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_plans": {
                  Row: {
                    "created_at": string,"description": string | null,"gym_id": string,"id": string,"is_active": boolean,"name": string,"period": Database["public"]['Enums']["plan_period"],"period_count": number,"price_usd": number,"visit_limit": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"gym_id": string,"id"?: string,"is_active"?: boolean,"name": string,"period"?: Database["public"]['Enums']["plan_period"],"period_count"?: number,"price_usd": number,"visit_limit"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"gym_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"period"?: Database["public"]['Enums']["plan_period"],"period_count"?: number,"price_usd"?: number,"visit_limit"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_plans_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "cancelled_at": string | null,"created_at": string,"created_by": string | null,"ends_on": string,"frozen_on": string | null,"gym_id": string,"id": string,"member_id": string,"plan_id": string | null,"plan_name": string,"starts_on": string,"visit_limit": number | null,"visits_used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"frozen_on"?: string | null,"gym_id": string,"id"?: string,"member_id": string,"plan_id"?: string | null,"plan_name": string,"starts_on": string,"visit_limit"?: number | null,"visits_used"?: number
                  }
                  Update: {
                    "cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"frozen_on"?: string | null,"gym_id"?: string,"id"?: string,"member_id"?: string,"plan_id"?: string | null,"plan_name"?: string,"starts_on"?: string,"visit_limit"?: number | null,"visits_used"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "membership_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_lbp": number | null,"amount_usd": number,"gym_id": string,"id": string,"invoice_id": string,"lbp_rate": number | null,"member_id": string,"method": Database["public"]['Enums']["payment_method"],"note": string | null,"paid_at": string,"received_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_lbp"?: number | null,"amount_usd": number,"gym_id": string,"id"?: string,"invoice_id": string,"lbp_rate"?: number | null,"member_id": string,"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string,"received_by"?: string | null
                  }
                  Update: {
                    "amount_lbp"?: number | null,"amount_usd"?: number,"gym_id"?: string,"id"?: string,"invoice_id"?: string,"lbp_rate"?: number | null,"member_id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string,"received_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoice_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "invoice_summary": {
                  Row: {
                    "amount_usd": number,"balance_usd": number | null,"created_at": string,"created_by": string | null,"description": string,"discount_usd": number,"gym_id": string,"id": string,"issued_on": string,"member_id": string,"membership_id": string | null,"number": number,"paid_usd": number | null,"status": string | null,"total_usd": number | null,"void_reason": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "invoices_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"member_overview": {
                  Row: {
                    "balance_usd": number | null,"checkin_code": string,"created_at": string,"created_by": string | null,"email": string | null,"ends_on": string | null,"frozen_on": string | null,"full_name": string,"gym_id": string,"id": string,"last_checkin_at": string | null,"membership_id": string | null,"notes": string | null,"phone": string | null,"plan_name": string | null,"starts_on": string | null,"status": string | null,"user_id": string | null,"visit_limit": number | null,"visits_used": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "members_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_payment":
{ Args: { "p_amount_lbp"?: number,"p_amount_usd": number,"p_invoice_id": string,"p_method": Database["public"]['Enums']["payment_method"],"p_note"?: string }; Returns: string
                           },
"can_assign_role":
{ Args: { "p_gym_id": string,"p_role": Database["public"]['Enums']["gym_role"] }; Returns: boolean
                           },
"can_handle_billing":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"check_in":
{ Args: { "p_code"?: string,"p_gym_id": string,"p_member_id"?: string }; Returns: {
              "allowed": boolean,"already_in": boolean,"balance_usd": number,"ends_on": string,"full_name": string,"member_id": string,"plan_name": string,"reason": string,"visits_left": number
            }[]
                           },
"claim_invites_for":
{ Args: { "p_email": string,"p_user_id": string }; Returns: number
                           },
"claim_my_invites":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_gym":
{ Args: { "p_name": string }; Returns: string
                           },
"get_checkin_token":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"gym_stats":
{ Args: { "p_gym_id": string }; Returns: {
              "active_members": number,"checkins_today": number,"collected_month": number,"expiring_soon": number,"outstanding": number
            }[]
                           },
"gym_today":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"has_gym_role":
{ Args: { "p_gym_id": string,"p_roles": (Database["public"]['Enums']["gym_role"])[] }; Returns: boolean
                           },
"is_gym_staff":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"is_my_member":
{ Args: { "p_member_id": string }; Returns: boolean
                           },
"membership_rank":
{ Args: { "ms": Omit<Database["public"]['Tables']["memberships"]['Row'], Database["public"]['Tables']["memberships"]['ComputedFields']>,"p_today": string }; Returns: number
                           },
"my_gym_role":
{ Args: { "p_gym_id": string }; Returns: Database["public"]['Enums']["gym_role"]
                           },
"new_checkin_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"record_check_in":
{ Args: { "p_gym_id": string,"p_member_id": string,"p_source": string }; Returns: {
              "allowed": boolean,"already_in": boolean,"balance_usd": number,"ends_on": string,"full_name": string,"member_id": string,"plan_name": string,"reason": string,"visits_left": number
            }[]
                           },
"require_billing":
{ Args: { "p_gym_id": string }; Returns: undefined
                           },
"rotate_checkin_token":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"self_check_in":
{ Args: { "p_token": string }; Returns: {
              "allowed": boolean,"already_in": boolean,"balance_usd": number,"ends_on": string,"full_name": string,"member_id": string,"plan_name": string,"reason": string,"visits_left": number
            }[]
                           },
"sell_membership":
{ Args: { "p_amount_lbp"?: number,"p_discount_usd"?: number,"p_member_id": string,"p_method"?: Database["public"]['Enums']["payment_method"],"p_paid_usd"?: number,"p_plan_id": string,"p_starts_on": string }; Returns: string
                           },
"update_membership":
{ Args: { "p_action": string,"p_membership_id": string }; Returns: undefined
                           },
"void_invoice":
{ Args: { "p_invoice_id": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "gym_role": "owner"|"manager"|"front_desk"|"trainer"|"member","payment_method": "cash_usd"|"cash_lbp"|"card"|"whish"|"omt"|"bank_transfer"|"other","plan_period": "day"|"week"|"month"|"year"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "gym_role": ["owner", "manager", "front_desk", "trainer", "member"],"payment_method": ["cash_usd", "cash_lbp", "card", "whish", "omt", "bank_transfer", "other"],"plan_period": ["day", "week", "month", "year"]
          }
        }
} as const
