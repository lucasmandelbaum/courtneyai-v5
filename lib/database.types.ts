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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
          updated_at?: string
        }
      }
      photos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
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
          }
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
          url?: string | null
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
          }
        ]
      }
      reels: {
        Row: {
          id: string
          product_id: string | null
          script_id: string | null
          template_id: number | null
          title: string
          duration: number | null
          created_at: string
          status: string
          user_id: string | null
          storage_path: string | null
          file_name: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          script_id?: string | null
          template_id?: number | null
          title: string
          duration?: number | null
          created_at?: string
          status?: string
          user_id?: string | null
          storage_path?: string | null
          file_name?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          script_id?: string | null
          template_id?: number | null
          title?: string
          duration?: number | null
          created_at?: string
          status?: string
          user_id?: string | null
          storage_path?: string | null
          file_name?: string | null
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
          }
        ]
      }
      scripts: {
        Row: {
          id: string
          product_id: string | null
          title: string
          content: string
          prompt: string | null
          created_at: string
          user_id: string | null
          caption: string | null
          hook_category: string | null
          hook_template: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          title: string
          content: string
          prompt?: string | null
          created_at?: string
          user_id?: string | null
          caption?: string | null
          hook_category?: string | null
          hook_template?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          product_id?: string | null
          title?: string
          content?: string
          prompt?: string | null
          created_at?: string
          user_id?: string | null
          caption?: string | null
          hook_category?: string | null
          hook_template?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
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
          }
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 