
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
            "access_biometrics": {
                  Row: {
                    "fields": NonNullable<Json>,"gym_id": string,"id": string,"kind": string,"member_id": string,"slot": string,"source_device_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fields": NonNullable<Json>,"gym_id": string,"id"?: string,"kind": string,"member_id": string,"slot": string,"source_device_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "fields"?: NonNullable<Json>,"gym_id"?: string,"id"?: string,"kind"?: string,"member_id"?: string,"slot"?: string,"source_device_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_biometrics_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_biometrics_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_biometrics_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_biometrics_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_biometrics_source_device_id_fkey"
      columns: ["source_device_id"]
isOneToOne: false
      referencedRelation: "access_devices"
      referencedColumns: ["id"]
    }
                  ]
                },"access_bridges": {
                  Row: {
                    "created_at": string,"gym_id": string,"last_seen_at": string | null,"token": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gym_id": string,"last_seen_at"?: string | null,"token"?: string,"version"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"gym_id"?: string,"last_seen_at"?: string | null,"token"?: string,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_bridges_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: true
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_bridges_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: true
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"access_commands": {
                  Row: {
                    "attempts": number,"created_at": string,"device_id": string,"done_at": string | null,"gym_id": string,"id": number,"kind": string,"member_id": string | null,"payload": NonNullable<Json>,"result": string | null,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"device_id": string,"done_at"?: string | null,"gym_id": string,"id"?: never,"kind": string,"member_id"?: string | null,"payload"?: NonNullable<Json>,"result"?: string | null,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"device_id"?: string,"done_at"?: string | null,"gym_id"?: string,"id"?: never,"kind"?: string,"member_id"?: string | null,"payload"?: NonNullable<Json>,"result"?: string | null,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_commands_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "access_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_commands_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_commands_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_commands_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_commands_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"access_device_secrets": {
                  Row: {
                    "device_id": string,"password": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device_id": string,"password": string
                  }
                  Update: {
                    "device_id"?: string,"password"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_device_secrets_device_id_fkey"
      columns: ["device_id"]
isOneToOne: true
      referencedRelation: "access_devices"
      referencedColumns: ["id"]
    }
                  ]
                },"access_devices": {
                  Row: {
                    "connection": string,"created_at": string,"direction": string,"door_no": number,"event_token": string,"gym_id": string,"host": string | null,"id": string,"info": NonNullable<Json>,"is_active": boolean,"last_error": string | null,"last_reconciled_on": string | null,"last_seen_at": string | null,"name": string,"serial_number": string | null,"username": string,"vendor": string,"zone_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "connection": string,"created_at"?: string,"direction"?: string,"door_no"?: number,"event_token"?: string,"gym_id": string,"host"?: string | null,"id"?: string,"info"?: NonNullable<Json>,"is_active"?: boolean,"last_error"?: string | null,"last_reconciled_on"?: string | null,"last_seen_at"?: string | null,"name": string,"serial_number"?: string | null,"username"?: string,"vendor": string,"zone_id"?: string | null
                  }
                  Update: {
                    "connection"?: string,"created_at"?: string,"direction"?: string,"door_no"?: number,"event_token"?: string,"gym_id"?: string,"host"?: string | null,"id"?: string,"info"?: NonNullable<Json>,"is_active"?: boolean,"last_error"?: string | null,"last_reconciled_on"?: string | null,"last_seen_at"?: string | null,"name"?: string,"serial_number"?: string | null,"username"?: string,"vendor"?: string,"zone_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_devices_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_devices_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_devices_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "access_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"access_events": {
                  Row: {
                    "checkin_id": string | null,"created_at": string,"device_id": string,"direction": string,"granted": boolean,"gym_id": string,"id": number,"member_id": string | null,"method": string,"occurred_at": string,"outcome": string | null,"pin": string | null,"raw": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_id"?: string | null,"created_at"?: string,"device_id": string,"direction": string,"granted": boolean,"gym_id": string,"id"?: never,"member_id"?: string | null,"method"?: string,"occurred_at": string,"outcome"?: string | null,"pin"?: string | null,"raw"?: NonNullable<Json>
                  }
                  Update: {
                    "checkin_id"?: string | null,"created_at"?: string,"device_id"?: string,"direction"?: string,"granted"?: boolean,"gym_id"?: string,"id"?: never,"member_id"?: string | null,"method"?: string,"occurred_at"?: string,"outcome"?: string | null,"pin"?: string | null,"raw"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_events_checkin_id_fkey"
      columns: ["checkin_id"]
isOneToOne: false
      referencedRelation: "checkins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "access_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_events_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"access_grants": {
                  Row: {
                    "device_id": string,"gym_id": string,"member_id": string,"sent_card": string | null,"sent_name": string | null,"updated_at": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "device_id": string,"gym_id": string,"member_id": string,"sent_card"?: string | null,"sent_name"?: string | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "device_id"?: string,"gym_id"?: string,"member_id"?: string,"sent_card"?: string | null,"sent_name"?: string | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_grants_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "access_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grants_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_grants_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grants_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grants_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"access_zones": {
                  Row: {
                    "created_at": string,"gym_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gym_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"gym_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_zones_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "access_zones_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"gym_id": string,"id": string,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"gym_id": string,"id"?: string,"summary": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"gym_id"?: string,"id"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "activity_log_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"body_measurements": {
                  Row: {
                    "arm_cm": number | null,"body_fat_pct": number | null,"chest_cm": number | null,"created_at": string,"gym_id": string,"hips_cm": number | null,"id": string,"measured_on": string,"member_id": string,"muscle_mass_kg": number | null,"notes": string | null,"recorded_by": string | null,"source": string,"thigh_cm": number | null,"waist_cm": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arm_cm"?: number | null,"body_fat_pct"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"gym_id": string,"hips_cm"?: number | null,"id"?: string,"measured_on": string,"member_id": string,"muscle_mass_kg"?: number | null,"notes"?: string | null,"recorded_by"?: string | null,"source"?: string,"thigh_cm"?: number | null,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "arm_cm"?: number | null,"body_fat_pct"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"gym_id"?: string,"hips_cm"?: number | null,"id"?: string,"measured_on"?: string,"member_id"?: string,"muscle_mass_kg"?: number | null,"notes"?: string | null,"recorded_by"?: string | null,"source"?: string,"thigh_cm"?: number | null,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "body_measurements_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "body_measurements_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "body_measurements_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "body_measurements_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "body_measurements_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
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
                },"class_bookings": {
                  Row: {
                    "class_id": string,"created_at": string,"gym_id": string,"id": string,"member_id": string,"session_date": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"gym_id": string,"id"?: string,"member_id": string,"session_date": string,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"gym_id"?: string,"id"?: string,"member_id"?: string,"session_date"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_bookings_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "class_bookings_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"class_subscriptions": {
                  Row: {
                    "class_id": string,"created_at": string,"created_by": string | null,"ends_on": string,"gym_id": string,"id": string,"invoice_id": string | null,"member_id": string,"price_usd": number,"starts_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"gym_id": string,"id"?: string,"invoice_id"?: string | null,"member_id": string,"price_usd"?: number,"starts_on": string,"status"?: string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"gym_id"?: string,"id"?: string,"invoice_id"?: string | null,"member_id"?: string,"price_usd"?: number,"starts_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_subscriptions_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subscriptions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subscriptions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "class_subscriptions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subscriptions_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoice_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subscriptions_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subscriptions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subscriptions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "capacity": number,"created_at": string,"description": string | null,"duration_min": number,"gym_id": string,"id": string,"is_active": boolean,"location": string | null,"monthly_price_usd": number | null,"name": string,"start_time": string,"trainer_id": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"duration_min"?: number,"gym_id": string,"id"?: string,"is_active"?: boolean,"location"?: string | null,"monthly_price_usd"?: number | null,"name": string,"start_time": string,"trainer_id"?: string | null,"weekday": number
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"duration_min"?: number,"gym_id"?: string,"id"?: string,"is_active"?: boolean,"location"?: string | null,"monthly_price_usd"?: number | null,"name"?: string,"start_time"?: string,"trainer_id"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "classes_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classes_trainer_id_fkey"
      columns: ["trainer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"gym_id": string,"id": string,"last_message_at": string | null,"member_id": string,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gym_id": string,"id"?: string,"last_message_at"?: string | null,"member_id": string,"staff_id": string
                  }
                  Update: {
                    "created_at"?: string,"gym_id"?: string,"id"?: string,"last_message_at"?: string | null,"member_id"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "conversations_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "category": string | null,"equipment": string | null,"force": string | null,"id": string,"image_paths": (string)[],"instructions": (string)[],"level": string | null,"mechanic": string | null,"name": string,"primary_muscles": (string)[],"secondary_muscles": (string)[],"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"equipment"?: string | null,"force"?: string | null,"id": string,"image_paths"?: (string)[],"instructions"?: (string)[],"level"?: string | null,"mechanic"?: string | null,"name": string,"primary_muscles"?: (string)[],"secondary_muscles"?: (string)[],"source"?: string
                  }
                  Update: {
                    "category"?: string | null,"equipment"?: string | null,"force"?: string | null,"id"?: string,"image_paths"?: (string)[],"instructions"?: (string)[],"level"?: string | null,"mechanic"?: string | null,"name"?: string,"primary_muscles"?: (string)[],"secondary_muscles"?: (string)[],"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"features": {
                  Row: {
                    "created_at": string,"description": string,"key": string,"name": string,"rollout": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"key": string,"name": string,"rollout"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"key"?: string,"name"?: string,"rollout"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gym_feature_overrides": {
                  Row: {
                    "enabled": boolean,"feature_key": string,"gym_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled": boolean,"feature_key": string,"gym_id": string
                  }
                  Update: {
                    "enabled"?: boolean,"feature_key"?: string,"gym_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gym_feature_overrides_feature_key_fkey"
      columns: ["feature_key"]
isOneToOne: false
      referencedRelation: "features"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "gym_feature_overrides_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "gym_feature_overrides_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"gym_machines": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"gym_id": string,"id": string,"name": string,"photo_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"gym_id": string,"id"?: string,"name": string,"photo_path"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"gym_id"?: string,"id"?: string,"name"?: string,"photo_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gym_machines_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gym_machines_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "gym_machines_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
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
                    "checkin_token": string,"created_at": string,"created_by": string | null,"equipment": (string)[],"id": string,"is_lab": boolean,"lbp_rate": number,"name": string,"next_invoice_number": number,"paid_until": string | null,"portal_hidden": (string)[],"program_price_usd": number,"renewal_reminder_days": number,"slug": string,"suspended_at": string | null,"suspended_reason": string | null,"tap_simulator": boolean,"timezone": string,"trial_ends_at": string,"unpaid_grace_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_token"?: string,"created_at"?: string,"created_by"?: string | null,"equipment"?: (string)[],"id"?: string,"is_lab"?: boolean,"lbp_rate"?: number,"name": string,"next_invoice_number"?: number,"paid_until"?: string | null,"portal_hidden"?: (string)[],"program_price_usd"?: number,"renewal_reminder_days"?: number,"slug": string,"suspended_at"?: string | null,"suspended_reason"?: string | null,"tap_simulator"?: boolean,"timezone"?: string,"trial_ends_at"?: string,"unpaid_grace_days"?: number
                  }
                  Update: {
                    "checkin_token"?: string,"created_at"?: string,"created_by"?: string | null,"equipment"?: (string)[],"id"?: string,"is_lab"?: boolean,"lbp_rate"?: number,"name"?: string,"next_invoice_number"?: number,"paid_until"?: string | null,"portal_hidden"?: (string)[],"program_price_usd"?: number,"renewal_reminder_days"?: number,"slug"?: string,"suspended_at"?: string | null,"suspended_reason"?: string | null,"tap_simulator"?: boolean,"timezone"?: string,"trial_ends_at"?: string,"unpaid_grace_days"?: number
                  }
                  Relationships: [
                    
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string | null,"expires_at": string,"gym_id": string,"id": string,"invited_by": string | null,"member_id": string | null,"role": Database["public"]['Enums']["gym_role"],"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"gym_id": string,"id"?: string,"invited_by"?: string | null,"member_id"?: string | null,"role": Database["public"]['Enums']["gym_role"],"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"gym_id"?: string,"id"?: string,"invited_by"?: string | null,"member_id"?: string | null,"role"?: Database["public"]['Enums']["gym_role"],"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "invites_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
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
                },"machine_exercises": {
                  Row: {
                    "exercise_id": string,"machine_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"machine_id": string
                  }
                  Update: {
                    "exercise_id"?: string,"machine_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "machine_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machine_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machine_exercises_machine_id_fkey"
      columns: ["machine_id"]
isOneToOne: false
      referencedRelation: "gym_machines"
      referencedColumns: ["id"]
    }
                  ]
                },"member_training_days": {
                  Row: {
                    "created_at": string,"member_id": string,"program_day_id": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"member_id": string,"program_day_id"?: string | null,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"member_id"?: string,"program_day_id"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_training_days_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_training_days_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_training_days_program_day_id_fkey"
      columns: ["program_day_id"]
isOneToOne: false
      referencedRelation: "program_days"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "access_card": string | null,"access_pin": number | null,"archived_at": string | null,"checkin_code": string,"created_at": string,"created_by": string | null,"email": string | null,"full_name": string,"gym_id": string,"id": string,"notes": string | null,"phone": string | null,"unpaid_frozen_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_card"?: string | null,"access_pin"?: number | null,"archived_at"?: string | null,"checkin_code"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name": string,"gym_id": string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"unpaid_frozen_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "access_card"?: string | null,"access_pin"?: number | null,"archived_at"?: string | null,"checkin_code"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name"?: string,"gym_id"?: string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"unpaid_frozen_at"?: string | null,"user_id"?: string | null
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
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
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"read_at": string | null,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"dedupe_key": string | null,"gym_id": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"gym_id": string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"gym_id"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "notifications_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"nutrition_meals": {
                  Row: {
                    "calories": number | null,"created_at": string,"id": string,"items": string,"name": string,"plan_id": string,"position": number,"time_label": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "calories"?: number | null,"created_at"?: string,"id"?: string,"items"?: string,"name": string,"plan_id": string,"position"?: number,"time_label"?: string | null
                  }
                  Update: {
                    "calories"?: number | null,"created_at"?: string,"id"?: string,"items"?: string,"name"?: string,"plan_id"?: string,"position"?: number,"time_label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nutrition_meals_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "nutrition_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"nutrition_plans": {
                  Row: {
                    "calories": number | null,"carbs_g": number | null,"created_at": string,"dietitian_id": string | null,"fat_g": number | null,"guidelines": string | null,"gym_id": string,"id": string,"member_id": string,"name": string,"protein_g": number | null,"request_id": string | null,"sent_at": string | null,"status": string,"updated_at": string,"water_l": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "calories"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"dietitian_id"?: string | null,"fat_g"?: number | null,"guidelines"?: string | null,"gym_id": string,"id"?: string,"member_id": string,"name"?: string,"protein_g"?: number | null,"request_id"?: string | null,"sent_at"?: string | null,"status"?: string,"updated_at"?: string,"water_l"?: number | null
                  }
                  Update: {
                    "calories"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"dietitian_id"?: string | null,"fat_g"?: number | null,"guidelines"?: string | null,"gym_id"?: string,"id"?: string,"member_id"?: string,"name"?: string,"protein_g"?: number | null,"request_id"?: string | null,"sent_at"?: string | null,"status"?: string,"updated_at"?: string,"water_l"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nutrition_plans_dietitian_id_fkey"
      columns: ["dietitian_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_plans_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "nutrition_plans_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_plans_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_plans_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_plans_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "nutrition_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"nutrition_requests": {
                  Row: {
                    "activity": string,"allergies": string | null,"created_at": string,"dietitian_id": string | null,"goal": string,"gym_id": string,"height_cm": number | null,"id": string,"member_id": string,"notes": string | null,"plan_id": string | null,"preferences": string | null,"status": string,"updated_at": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity"?: string,"allergies"?: string | null,"created_at"?: string,"dietitian_id"?: string | null,"goal": string,"gym_id": string,"height_cm"?: number | null,"id"?: string,"member_id": string,"notes"?: string | null,"plan_id"?: string | null,"preferences"?: string | null,"status"?: string,"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "activity"?: string,"allergies"?: string | null,"created_at"?: string,"dietitian_id"?: string | null,"goal"?: string,"gym_id"?: string,"height_cm"?: number | null,"id"?: string,"member_id"?: string,"notes"?: string | null,"plan_id"?: string | null,"preferences"?: string | null,"status"?: string,"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nutrition_requests_dietitian_id_fkey"
      columns: ["dietitian_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_requests_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "nutrition_requests_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_requests_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_requests_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutrition_requests_plan_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "nutrition_plans"
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
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
                },"plan_access_zones": {
                  Row: {
                    "plan_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "plan_id": string,"zone_id": string
                  }
                  Update: {
                    "plan_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_access_zones_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "membership_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_access_zones_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "access_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admin_visits": {
                  Row: {
                    "gym_id": string,"role": Database["public"]['Enums']["gym_role"],"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gym_id": string,"role"?: Database["public"]['Enums']["gym_role"],"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "gym_id"?: string,"role"?: Database["public"]['Enums']["gym_role"],"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admin_visits_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "platform_admin_visits_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_events": {
                  Row: {
                    "browser": string | null,"country": string | null,"created_at": string,"detail": NonNullable<Json>,"device": string | null,"id": number,"ip": string | null,"kind": string,"message": string | null,"method": string | null,"path": string | null,"referrer": string | null,"request_type": string | null,"user_id": string | null,"visitor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"country"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"device"?: string | null,"id"?: never,"ip"?: string | null,"kind": string,"message"?: string | null,"method"?: string | null,"path"?: string | null,"referrer"?: string | null,"request_type"?: string | null,"user_id"?: string | null,"visitor_id"?: string | null
                  }
                  Update: {
                    "browser"?: string | null,"country"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"device"?: string | null,"id"?: never,"ip"?: string | null,"kind"?: string,"message"?: string | null,"method"?: string | null,"path"?: string | null,"referrer"?: string | null,"request_type"?: string | null,"user_id"?: string | null,"visitor_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_payments": {
                  Row: {
                    "amount_usd": number,"created_at": string,"gym_id": string,"id": string,"method": string,"months": number,"note": string | null,"paid_until": string,"recorded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_usd": number,"created_at"?: string,"gym_id": string,"id"?: string,"method": string,"months": number,"note"?: string | null,"paid_until": string,"recorded_by"?: string | null
                  }
                  Update: {
                    "amount_usd"?: number,"created_at"?: string,"gym_id"?: string,"id"?: string,"method"?: string,"months"?: number,"note"?: string | null,"paid_until"?: string,"recorded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_payments_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "platform_payments_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_secrets": {
                  Row: {
                    "id": boolean,"updated_at": string,"whatsapp_phone_number_id": string,"whatsapp_token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: boolean,"updated_at"?: string,"whatsapp_phone_number_id"?: string,"whatsapp_token"?: string
                  }
                  Update: {
                    "id"?: boolean,"updated_at"?: string,"whatsapp_phone_number_id"?: string,"whatsapp_token"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "grace_days": number,"id": boolean,"payment_instructions": string,"price_usd": number,"trial_days": number,"updated_at": string,"whatsapp": string
                  }
                  ComputedFields: never
                  Insert: {
                    "grace_days"?: number,"id"?: boolean,"payment_instructions"?: string,"price_usd"?: number,"trial_days"?: number,"updated_at"?: string,"whatsapp"?: string
                  }
                  Update: {
                    "grace_days"?: number,"id"?: boolean,"payment_instructions"?: string,"price_usd"?: number,"trial_days"?: number,"updated_at"?: string,"whatsapp"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"language": string,"notify_prefs": NonNullable<Json>,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id": string,"language"?: string,"notify_prefs"?: NonNullable<Json>,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"language"?: string,"notify_prefs"?: NonNullable<Json>,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"program_days": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"program_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"program_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"program_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_days_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"program_exercises": {
                  Row: {
                    "day_id": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"reps": string,"rest_seconds": number,"sets": number,"swapped_at": string | null,"swapped_from": string | null,"target_weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "day_id": string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position"?: number,"reps"?: string,"rest_seconds"?: number,"sets"?: number,"swapped_at"?: string | null,"swapped_from"?: string | null,"target_weight_kg"?: number | null
                  }
                  Update: {
                    "day_id"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"reps"?: string,"rest_seconds"?: number,"sets"?: number,"swapped_at"?: string | null,"swapped_from"?: string | null,"target_weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_exercises_day_id_fkey"
      columns: ["day_id"]
isOneToOne: false
      referencedRelation: "program_days"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_swapped_from_fkey"
      columns: ["swapped_from"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_swapped_from_fkey"
      columns: ["swapped_from"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"program_requests": {
                  Row: {
                    "created_at": string,"days_per_week": number,"experience": Database["public"]['Enums']["experience_level"],"goal": Database["public"]['Enums']["program_goal"],"gym_id": string,"id": string,"injuries": string | null,"invoice_id": string | null,"member_id": string,"notes": string | null,"preferred_trainer_id": string | null,"program_id": string | null,"status": string,"trainer_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"days_per_week": number,"experience": Database["public"]['Enums']["experience_level"],"goal": Database["public"]['Enums']["program_goal"],"gym_id": string,"id"?: string,"injuries"?: string | null,"invoice_id"?: string | null,"member_id": string,"notes"?: string | null,"preferred_trainer_id"?: string | null,"program_id"?: string | null,"status"?: string,"trainer_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"days_per_week"?: number,"experience"?: Database["public"]['Enums']["experience_level"],"goal"?: Database["public"]['Enums']["program_goal"],"gym_id"?: string,"id"?: string,"injuries"?: string | null,"invoice_id"?: string | null,"member_id"?: string,"notes"?: string | null,"preferred_trainer_id"?: string | null,"program_id"?: string | null,"status"?: string,"trainer_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_requests_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "program_requests_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoice_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_preferred_trainer_id_fkey"
      columns: ["preferred_trainer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_program_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_requests_trainer_id_fkey"
      columns: ["trainer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"gym_id": string,"id": string,"is_active": boolean,"kind": string,"member_id": string | null,"name": string,"notes": string | null,"request_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"gym_id": string,"id"?: string,"is_active"?: boolean,"kind": string,"member_id"?: string | null,"name": string,"notes"?: string | null,"request_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"gym_id"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string,"member_id"?: string | null,"name"?: string,"notes"?: string | null,"request_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "programs_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "program_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"pt_sessions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"duration_min": number,"gym_id": string,"id": string,"member_id": string,"note": string | null,"starts_at": string,"status": string,"trainer_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"duration_min"?: number,"gym_id": string,"id"?: string,"member_id": string,"note"?: string | null,"starts_at": string,"status": string,"trainer_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"duration_min"?: number,"gym_id"?: string,"id"?: string,"member_id"?: string,"note"?: string | null,"starts_at"?: string,"status"?: string,"trainer_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pt_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pt_sessions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "pt_sessions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pt_sessions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pt_sessions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pt_sessions_trainer_id_fkey"
      columns: ["trainer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"set_logs": {
                  Row: {
                    "exercise_id": string,"id": string,"logged_at": string,"member_id": string,"reps": number,"session_id": string,"set_number": number,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"id"?: string,"logged_at"?: string,"member_id": string,"reps": number,"session_id": string,"set_number": number,"weight_kg"?: number
                  }
                  Update: {
                    "exercise_id"?: string,"id"?: string,"logged_at"?: string,"member_id"?: string,"reps"?: number,"session_id"?: string,"set_number"?: number,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "set_logs_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_log": {
                  Row: {
                    "body": string | null,"created_at": string,"error": string | null,"gym_id": string,"id": string,"kind": string,"member_id": string | null,"ref": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"error"?: string | null,"gym_id": string,"id"?: string,"kind": string,"member_id"?: string | null,"ref": string,"status"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"error"?: string | null,"gym_id"?: string,"id"?: string,"kind"?: string,"member_id"?: string | null,"ref"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_log_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "whatsapp_log_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_log_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_log_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_exercises": {
                  Row: {
                    "added_via": string,"created_at": string,"exercise_id": string,"id": string,"machine_id": string | null,"member_id": string,"position": number,"program_exercise_id": string | null,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_via"?: string,"created_at"?: string,"exercise_id": string,"id"?: string,"machine_id"?: string | null,"member_id": string,"position"?: number,"program_exercise_id"?: string | null,"session_id": string
                  }
                  Update: {
                    "added_via"?: string,"created_at"?: string,"exercise_id"?: string,"id"?: string,"machine_id"?: string | null,"member_id"?: string,"position"?: number,"program_exercise_id"?: string | null,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_machine_id_fkey"
      columns: ["machine_id"]
isOneToOne: false
      referencedRelation: "gym_machines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_program_exercise_id_fkey"
      columns: ["program_exercise_id"]
isOneToOne: false
      referencedRelation: "program_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_sessions": {
                  Row: {
                    "day_id": string | null,"day_name": string | null,"finished_at": string | null,"gym_id": string,"id": string,"member_id": string,"notes": string | null,"program_id": string | null,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day_id"?: string | null,"day_name"?: string | null,"finished_at"?: string | null,"gym_id": string,"id"?: string,"member_id": string,"notes"?: string | null,"program_id"?: string | null,"started_at"?: string
                  }
                  Update: {
                    "day_id"?: string | null,"day_name"?: string | null,"finished_at"?: string | null,"gym_id"?: string,"id"?: string,"member_id"?: string,"notes"?: string | null,"program_id"?: string | null,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sessions_day_id_fkey"
      columns: ["day_id"]
isOneToOne: false
      referencedRelation: "program_days"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
    },{
      foreignKeyName: "workout_sessions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "exercise_bests": {
                  Row: {
                    "best_bodyweight_reps": number | null,"best_est_1rm_kg": number | null,"best_weight_kg": number | null,"exercise_id": string,"last_logged_at": string | null,"member_id": string,"sessions": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "set_logs_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "gym_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"gym_exercises": {
                  Row: {
                    "category": string | null,"equipment": string | null,"force": string | null,"gym_id": string,"id": string,"image_paths": (string)[],"instructions": (string)[],"level": string | null,"mechanic": string | null,"name": string,"primary_muscles": (string)[],"secondary_muscles": (string)[],"source": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"invoice_summary": {
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
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
                    "archived_at": string | null,"balance_usd": number | null,"checkin_code": string,"created_at": string,"created_by": string | null,"email": string | null,"ends_on": string | null,"frozen_on": string | null,"full_name": string,"gym_id": string,"id": string,"last_checkin_at": string | null,"membership_id": string | null,"notes": string | null,"phone": string | null,"plan_name": string | null,"starts_on": string | null,"status": string | null,"unpaid_frozen_at": string | null,"user_id": string | null,"visit_limit": number | null,"visits_used": number | null
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
      referencedRelation: "gym_exercises"
      referencedColumns: ["gym_id"]
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
            "accept_invite":
{ Args: { "p_token": string }; Returns: Database["public"]['Enums']["gym_role"]
                           },
"access_bridge_status":
{ Args: { "p_gym_id": string }; Returns: {
              "last_seen_at": string,"version": string
            }[]
                           },
"access_bridge_token":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"access_command_done":
{ Args: { "p_command_id": number,"p_device_id": string,"p_ok": boolean,"p_result"?: string }; Returns: undefined
                           },
"access_device_counts":
{ Args: { "p_gym_id": string }; Returns: {
              "biometrics": number,"device_id": string,"failed": number,"granted": number,"pending": number
            }[]
                           },
"access_device_seen":
{ Args: { "p_device_id": string,"p_info"?: Json }; Returns: undefined
                           },
"access_ingest_event":
{ Args: { "p_at": string,"p_device_id": string,"p_direction": string,"p_granted": boolean,"p_method"?: string,"p_pin": string,"p_raw"?: Json }; Returns: string
                           },
"access_save_biometric":
{ Args: { "p_device_id": string,"p_fields": Json,"p_kind": string,"p_pin": string,"p_slot": string }; Returns: boolean
                           },
"access_save_card":
{ Args: { "p_card": string,"p_device_id": string,"p_pin": string }; Returns: boolean
                           },
"access_sync_device":
{ Args: { "p_device_id": string }; Returns: number
                           },
"access_sync_member":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"access_sync_one":
{ Args: { "p_device_id": string,"p_member_id": string }; Returns: undefined
                           },
"access_take_commands":
{ Args: { "p_device_id": string,"p_limit"?: number }; Returns: {
              "attempts": number,
"created_at": string,
"device_id": string,
"done_at": string | null,
"gym_id": string,
"id": number,
"kind": string,
"member_id": string | null,
"payload": NonNullable<Json>,
"result": string | null,
"sent_at": string | null,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "access_commands"
        isOneToOne: false
        isSetofReturn: true
      } },
"access_valid_until":
{ Args: { "p_device_id": string,"p_member_id": string }; Returns: string
                           },
"add_payment":
{ Args: { "p_amount_lbp"?: number,"p_amount_usd": number,"p_invoice_id": string,"p_method": Database["public"]['Enums']["payment_method"],"p_note"?: string }; Returns: string
                           },
"adjust_membership":
{ Args: { "p_ends_on": string,"p_membership_id": string,"p_starts_on": string,"p_visit_limit": number,"p_visits_used": number }; Returns: undefined
                           },
"admin_broadcast":
{ Args: { "p_audience": string,"p_body": string,"p_title": string }; Returns: number
                           },
"admin_extend_trial":
{ Args: { "p_days": number,"p_gym_id": string }; Returns: string
                           },
"admin_gym_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_members": number,"checkins_30d": number,"collected_30d": number,"created_at": string,"gym_id": string,"last_checkin_at": string,"members": number,"name": string,"owner_email": string,"owner_name": string,"owner_phone": string,"paid_until": string,"staff": number,"suspended_at": string,"suspended_reason": string,"trial_ends_at": string
            }[]
                           },
"admin_monitoring":
{ Args: { "p_days": number }; Returns: Json
                           },
"admin_platform_payments":
{ Args: { "p_limit"?: number }; Returns: {
              "amount_usd": number,"created_at": string,"gym_id": string,"gym_name": string,"id": string,"method": string,"months": number,"note": string,"paid_until": string,"recorded_by_name": string
            }[]
                           },
"admin_prune_events":
{ Args: { "p_keep_days": number }; Returns: number
                           },
"admin_recent_events":
{ Args: { "p_kinds": (string)[],"p_limit"?: number }; Returns: {
              "browser": string,"country": string,"created_at": string,"detail": Json,"device": string,"id": number,"ip": string,"kind": string,"message": string,"method": string,"path": string,"referrer": string,"request_type": string,"user_email": string,"user_id": string,"user_name": string,"visitor_id": string
            }[]
                           },
"admin_record_subscription_payment":
{ Args: { "p_amount_usd": number,"p_gym_id": string,"p_method": string,"p_months": number,"p_note"?: string }; Returns: string
                           },
"admin_save_platform_settings":
{ Args: { "p_instructions": string,"p_whatsapp": string }; Returns: undefined
                           },
"admin_save_pricing":
{ Args: { "p_grace_days": number,"p_price_usd": number,"p_trial_days": number }; Returns: undefined
                           },
"admin_set_gym_suspended":
{ Args: { "p_gym_id": string,"p_reason"?: string,"p_suspended": boolean }; Returns: undefined
                           },
"apply_unpaid_freeze":
{ Args: { "p_member_id": string }; Returns: boolean
                           },
"archive_nutrition_plan":
{ Args: { "p_plan_id": string }; Returns: undefined
                           },
"book_class":
{ Args: { "p_class_id": string,"p_date": string,"p_member_id"?: string }; Returns: string
                           },
"can_assign_role":
{ Args: { "p_gym_id": string,"p_role": Database["public"]['Enums']["gym_role"] }; Returns: boolean
                           },
"can_coach":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"can_diet":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"can_edit_program":
{ Args: { "p_program_id": string }; Returns: boolean
                           },
"can_handle_billing":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"can_view_nutrition_plan":
{ Args: { "p_plan_id": string }; Returns: boolean
                           },
"can_view_program":
{ Args: { "p_program_id": string }; Returns: boolean
                           },
"cancel_booking":
{ Args: { "p_booking_id": string }; Returns: undefined
                           },
"cancel_course_subscription":
{ Args: { "p_subscription_id": string }; Returns: undefined
                           },
"cancel_nutrition_request":
{ Args: { "p_request_id": string }; Returns: undefined
                           },
"cancel_program_request":
{ Args: { "p_request_id": string }; Returns: undefined
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
"class_spots":
{ Args: { "p_from": string,"p_gym_id": string,"p_to": string }; Returns: {
              "class_id": string,"session_date": string,"taken": number,"waiting": number
            }[]
                           },
"copy_program":
{ Args: { "p_source_id": string,"p_target_id": string }; Returns: undefined
                           },
"create_gym":
{ Args: { "p_name": string }; Returns: string
                           },
"create_member_program":
{ Args: { "p_member_id": string,"p_name": string,"p_request_id"?: string,"p_template_id"?: string }; Returns: string
                           },
"day_program":
{ Args: { "p_day_id": string }; Returns: string
                           },
"delete_checkin":
{ Args: { "p_checkin_id": string }; Returns: undefined
                           },
"delete_member":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"freeze_my_membership":
{ Args: { "p_action": string,"p_gym_id": string }; Returns: undefined
                           },
"freeze_unpaid_members":
{ Args: { "p_gym_id": string }; Returns: number
                           },
"get_checkin_token":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"gym_coaches":
{ Args: { "p_gym_id": string }; Returns: {
              "full_name": string,"id": string
            }[]
                           },
"gym_features":
{ Args: { "p_gym_id": string }; Returns: (string)[]
                           },
"gym_staff_names":
{ Args: { "p_gym_id": string }; Returns: {
              "full_name": string,"id": string,"role": Database["public"]['Enums']["gym_role"]
            }[]
                           },
"gym_stats":
{ Args: { "p_gym_id": string }; Returns: {
              "active_members": number,"checkins_today": number,"collected_month": number,"expiring_soon": number,"outstanding": number
            }[]
                           },
"gym_subscription":
{ Args: { "p_gym_id": string }; Returns: {
              "days_left": number,"ends_on": string,"paid_until": string,"status": string,"trial_ends_at": string
            }[]
                           },
"gym_today":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"has_gym_role":
{ Args: { "p_gym_id": string,"p_roles": (Database["public"]['Enums']["gym_role"])[] }; Returns: boolean
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "accepted": boolean,"email": string,"expired": boolean,"gym_name": string,"member_name": string,"role": Database["public"]['Enums']["gym_role"]
            }[]
                           },
"is_coach_of":
{ Args: { "p_gym_id": string,"p_user_id": string }; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"is_gym_staff":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"is_my_member":
{ Args: { "p_member_id": string }; Returns: boolean
                           },
"is_my_member_at":
{ Args: { "p_gym_id": string,"p_member_id": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_activity":
{ Args: { "p_action": string,"p_details"?: Json,"p_gym_id": string,"p_summary": string }; Returns: undefined
                           },
"machine_gym":
{ Args: { "p_machine_id": string }; Returns: string
                           },
"make_my_reminders":
{ Args: { "p_gym_id": string }; Returns: undefined
                           },
"make_training_reminder":
{ Args: { "p_gym_id": string }; Returns: undefined
                           },
"mark_attendance":
{ Args: { "p_attended": boolean,"p_booking_id": string }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: undefined
                           },
"member_invite_token":
{ Args: { "p_member_id": string }; Returns: string
                           },
"member_login_email":
{ Args: { "p_identifier": string }; Returns: string
                           },
"member_user":
{ Args: { "p_member_id": string }; Returns: string
                           },
"membership_rank":
{ Args: { "ms": Omit<Database["public"]['Tables']["memberships"]['Row'], Database["public"]['Tables']["memberships"]['ComputedFields']>,"p_today": string }; Returns: number
                           },
"my_account_status":
{ Args: { "p_gym_id": string }; Returns: {
              "balance_usd": number,"frozen": boolean,"frozen_at": string,"overdue_usd": number
            }[]
                           },
"my_gym_role":
{ Args: { "p_gym_id": string }; Returns: Database["public"]['Enums']["gym_role"]
                           },
"my_member_id":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"new_checkin_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"normalize_phone":
{ Args: { "p": string }; Returns: string
                           },
"note_personal_record":
{ Args: { "p_exercise": string,"p_gym_id": string,"p_weight": number }; Returns: undefined
                           },
"notify":
{ Args: { "p_body": string,"p_gym_id": string,"p_key"?: string,"p_kind": string,"p_link": string,"p_title": string,"p_user_id": string }; Returns: undefined
                           },
"notify_roles":
{ Args: { "p_body": string,"p_gym_id": string,"p_kind": string,"p_link": string,"p_roles": (Database["public"]['Enums']["gym_role"])[],"p_title": string }; Returns: undefined
                           },
"nutrition_plan_gym":
{ Args: { "p_plan_id": string }; Returns: string
                           },
"open_conversation":
{ Args: { "p_gym_id": string,"p_member_id"?: string,"p_staff_id"?: string }; Returns: string
                           },
"overdue_balance":
{ Args: { "p_member_id": string }; Returns: number
                           },
"platform_pricing":
{ Args: Record<PropertyKey, never>; Returns: {
              "grace_days": number,"price_usd": number,"trial_days": number
            }[]
                           },
"platform_trial_days":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"publish_program":
{ Args: { "p_program_id": string }; Returns: undefined
                           },
"record_check_in":
{ Args: { "p_gym_id": string,"p_member_id": string,"p_source": string }; Returns: {
              "allowed": boolean,"already_in": boolean,"balance_usd": number,"ends_on": string,"full_name": string,"member_id": string,"plan_name": string,"reason": string,"visits_left": number
            }[]
                           },
"refund_payment":
{ Args: { "p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"renewal_reminders_due":
{ Args: Record<PropertyKey, never>; Returns: {
              "ends_on": string,"full_name": string,"gym_id": string,"gym_name": string,"member_id": string,"membership_id": string,"phone": string
            }[]
                           },
"request_nutrition_plan":
{ Args: { "p_activity"?: string,"p_allergies"?: string,"p_goal": string,"p_gym_id": string,"p_height_cm"?: number,"p_notes"?: string,"p_preferences"?: string,"p_weight_kg"?: number }; Returns: string
                           },
"request_program":
{ Args: { "p_days_per_week": number,"p_experience": Database["public"]['Enums']["experience_level"],"p_goal": Database["public"]['Enums']["program_goal"],"p_gym_id": string,"p_injuries"?: string,"p_notes"?: string,"p_preferred_trainer_id"?: string }; Returns: string
                           },
"request_pt_session":
{ Args: { "p_duration"?: number,"p_gym_id": string,"p_note"?: string,"p_starts_at": string,"p_trainer_id": string }; Returns: string
                           },
"require_billing":
{ Args: { "p_gym_id": string }; Returns: undefined
                           },
"require_manager":
{ Args: { "p_gym_id": string }; Returns: undefined
                           },
"resync_access_device":
{ Args: { "p_device_id": string }; Returns: number
                           },
"rotate_checkin_token":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"save_as_template":
{ Args: { "p_name": string,"p_program_id": string }; Returns: string
                           },
"save_program":
{ Args: { "p_program": Json,"p_program_id": string }; Returns: undefined
                           },
"schedule_pt_session":
{ Args: { "p_duration"?: number,"p_member_id": string,"p_note"?: string,"p_starts_at": string,"p_trainer_id": string }; Returns: string
                           },
"self_check_in":
{ Args: { "p_token": string }; Returns: {
              "allowed": boolean,"already_in": boolean,"balance_usd": number,"ends_on": string,"full_name": string,"member_id": string,"plan_name": string,"reason": string,"visits_left": number
            }[]
                           },
"sell_membership":
{ Args: { "p_amount_lbp"?: number,"p_discount_usd"?: number,"p_member_id": string,"p_method"?: Database["public"]['Enums']["payment_method"],"p_paid_usd"?: number,"p_plan_id": string,"p_starts_on": string }; Returns: string
                           },
"send_nutrition_plan":
{ Args: { "p_plan_id": string }; Returns: undefined
                           },
"session_gym":
{ Args: { "p_session_id": string }; Returns: string
                           },
"session_member":
{ Args: { "p_session_id": string }; Returns: string
                           },
"set_access_device_password":
{ Args: { "p_device_id": string,"p_password": string }; Returns: undefined
                           },
"set_gym_equipment":
{ Args: { "p_equipment": (string)[],"p_gym_id": string }; Returns: undefined
                           },
"set_member_access_card":
{ Args: { "p_card": string,"p_member_id": string }; Returns: undefined
                           },
"set_member_archived":
{ Args: { "p_archived": boolean,"p_member_id": string }; Returns: undefined
                           },
"simulated_check_in":
{ Args: { "p_gym_id": string }; Returns: {
              "allowed": boolean,"already_in": boolean,"balance_usd": number,"ends_on": string,"full_name": string,"member_id": string,"plan_name": string,"reason": string,"visits_left": number
            }[]
                           },
"staff_counts":
{ Args: { "p_gym_id": string }; Returns: {
              "nutrition_requests": number,"program_requests": number,"pt_requests": number
            }[]
                           },
"start_nutrition_plan":
{ Args: { "p_member_id": string,"p_request_id"?: string }; Returns: string
                           },
"subscribe_to_course":
{ Args: { "p_class_id": string,"p_member_id"?: string,"p_starts_on"?: string }; Returns: string
                           },
"swap_program_exercise":
{ Args: { "p_exercise_id": string,"p_program_exercise_id": string }; Returns: undefined
                           },
"trainer_is_free":
{ Args: { "p_duration": number,"p_except"?: string,"p_starts_at": string,"p_trainer_id": string }; Returns: boolean
                           },
"update_membership":
{ Args: { "p_action": string,"p_membership_id": string }; Returns: undefined
                           },
"update_pt_session":
{ Args: { "p_action": string,"p_session_id": string }; Returns: undefined
                           },
"void_invoice":
{ Args: { "p_invoice_id": string,"p_reason": string }; Returns: undefined
                           },
"wants_notification":
{ Args: { "p_kind": string }; Returns: boolean
                           }
          }
          Enums: {
            "experience_level": "beginner"|"intermediate"|"advanced","gym_role": "owner"|"manager"|"front_desk"|"trainer"|"dietitian"|"member","payment_method": "cash_usd"|"cash_lbp"|"card"|"whish"|"omt"|"bank_transfer"|"other","plan_period": "day"|"week"|"month"|"year","program_goal": "lose_fat"|"build_muscle"|"strength"|"general_fitness"|"rehab"
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
            "experience_level": ["beginner", "intermediate", "advanced"],"gym_role": ["owner", "manager", "front_desk", "trainer", "dietitian", "member"],"payment_method": ["cash_usd", "cash_lbp", "card", "whish", "omt", "bank_transfer", "other"],"plan_period": ["day", "week", "month", "year"],"program_goal": ["lose_fat", "build_muscle", "strength", "general_fitness", "rehab"]
          }
        }
} as const
