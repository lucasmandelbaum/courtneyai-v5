export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      audio: {
        Row: {
          created_at: string
          duration: number | null
          file_name: string
          file_path: string
          id: string
          reel_id: string | null
          script_id: string | null
          transcription: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          file_name: string
          file_path: string
          id?: string
          reel_id?: string | null
          script_id?: string | null
          transcription?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          file_name?: string
          file_path?: string
          id?: string
          reel_id?: string | null
          script_id?: string | null
          transcription?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      hooks: {
        Row: {
          category: string
          created_at: string
          example: string | null
          id: string
          template: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          example?: string | null
          id?: string
          template: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          example?: string | null
          id?: string
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          organization_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          organization_id: string
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          organization_id: string
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          ai_analysis_id: string | null
          created_at: string
          description: string | null
          dimensions: Json | null
          file_name: string
          file_path: string
          id: string
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_analysis_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          file_name: string
          file_path: string
          id?: string
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_analysis_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          file_name?: string
          file_path?: string
          id?: string
          product_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          features: Json | null
          id: string
          interval: string
          name: string
          price: number
          stripe_price_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval: string
          name: string
          price: number
          stripe_price_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string
          name?: string
          price?: number
          stripe_price_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_descriptions: {
        Row: {
          created_at: string
          description: string
          id: string
          product_id: string
          source_url: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          product_id: string
          source_url: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string
          source_url?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_descriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      reel_media: {
        Row: {
          created_at: string
          display_order: number
          duration: number | null
          id: string
          media_type: string
          photo_id: string | null
          reel_id: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string
          display_order: number
          duration?: number | null
          id?: string
          media_type: string
          photo_id?: string | null
          reel_id?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          duration?: number | null
          id?: string
          media_type?: string
          photo_id?: string | null
          reel_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reel_media_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_media_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_media_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          created_at: string
          duration: number | null
          file_name: string | null
          id: string
          ordered_media: Json | null
          product_id: string | null
          progress_percentage: number | null
          script_id: string | null
          status: string
          storage_path: string | null
          template_id: number | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          file_name?: string | null
          id?: string
          ordered_media?: Json | null
          product_id?: string | null
          progress_percentage?: number | null
          script_id?: string | null
          status?: string
          storage_path?: string | null
          template_id?: number | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          file_name?: string | null
          id?: string
          ordered_media?: Json | null
          product_id?: string | null
          progress_percentage?: number | null
          script_id?: string | null
          status?: string
          storage_path?: string | null
          template_id?: number | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reels_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          caption: string | null
          content: string
          created_at: string
          hook_category: string | null
          hook_template: string | null
          id: string
          metadata: Json | null
          product_id: string | null
          prompt: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          caption?: string | null
          content: string
          created_at?: string
          hook_category?: string | null
          hook_template?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          prompt?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          caption?: string | null
          content?: string
          created_at?: string
          hook_category?: string | null
          hook_template?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          prompt?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created: string
          created_at: string
          id: string
          stripe_event_id: string
          type: string
        }
        Insert: {
          created: string
          created_at?: string
          id?: string
          stripe_event_id: string
          type: string
        }
        Update: {
          created?: string
          created_at?: string
          id?: string
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          browser_info: Json | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          response: string | null
          status: string
          title: string
          type: string
          updated_at: string
          url: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          browser_info?: Json | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          browser_info?: Json | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_metrics: {
        Row: {
          count: number
          created_at: string
          id: string
          metric_name: string
          organization_id: string
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          metric_name: string
          organization_id: string
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          metric_name?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          duration: number | null
          file_name: string
          file_path: string
          id: string
          product_id: string | null
          thumbnail: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          file_name: string
          file_path: string
          id?: string
          product_id?: string | null
          thumbnail?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          file_name?: string
          file_path?: string
          id?: string
          product_id?: string | null
          thumbnail?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_support_tickets: {
        Row: {
          admin_notes: string | null
          browser_info: Json | null
          created_at: string | null
          description: string | null
          id: string | null
          metadata: Json | null
          priority: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          title: string | null
          type: string | null
          updated_at: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_username: string | null
        }
        Relationships: []
      }
      organization_members_with_emails: {
        Row: {
          created_at: string | null
          id: string | null
          organization_id: string | null
          role: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_active_subscription: {
        Args: { org_id: string }
        Returns: {
          subscription_id: string
          plan_id: string
          stripe_subscription_id: string
          status: string
          current_period_end: string
        }[]
      }
      has_active_subscription: {
        Args: { org_id: string }
        Returns: boolean
      }
      increment_usage: {
        Args: {
          org_id: string
          metric: string
          amount: number
          period_start: string
        }
        Returns: undefined
      }
      is_current_user_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_current_user_owner: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_member_of_same_organization: {
        Args: { target_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 