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
      photos: {
        Row: {
          id: string
          created_at: string
          product_id: string | null
          user_id: string | null
          file_path: string
          file_name: string
          description: string | null
          ai_analysis_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          product_id?: string | null
          user_id?: string | null
          file_path: string
          file_name: string
          description?: string | null
          ai_analysis_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          product_id?: string | null
          user_id?: string | null
          file_path?: string
          file_name?: string
          description?: string | null
          ai_analysis_id?: string | null
        }
      }
      // ... rest of the tables ...
    }
  }
} 