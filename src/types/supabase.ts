// src/types/supabase.ts
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
      packages: {
        Row: {
          id: string
          user_id: string
          product_id: string | null
          batch_id: string | null
          tracking: string | null
          content: string | null
          quantity: number | null
          cost_price: number | null
          note: string | null
          verified: boolean | null
          timestamp: string | null
          updated_at: string
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          product_id?: string | null
          batch_id?: string | null
          tracking?: string | null
          content?: string | null
          quantity?: number | null
          cost_price?: number | null
          note?: string | null
          verified?: boolean | null
          timestamp?: string | null
          updated_at?: string
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string | null
          batch_id?: string | null
          tracking?: string | null
          content?: string | null
          quantity?: number | null
          cost_price?: number | null
          note?: string | null
          verified?: boolean | null
          timestamp?: string | null
          updated_at?: string
          is_deleted?: boolean
        }
      }
      sales: {
        Row: {
          id: string
          user_id: string
          items: Json
          total_amount: number
          total_profit: number
          timestamp: string
          status: string
          note: string | null
          updated_at: string
          is_deleted: boolean
        }
        Insert: {
          id: string
          user_id: string
          items: Json
          total_amount: number
          total_profit: number
          timestamp: string
          status?: string
          note?: string | null
          updated_at?: string
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          items?: Json
          total_amount?: number
          total_profit?: number
          timestamp?: string
          status?: string
          note?: string | null
          updated_at?: string
          is_deleted?: boolean
        }
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          barcode: string | null
          price: number
          stock_warning: number
          category: string | null
          created_at: string
          updated_at: string
          is_deleted: boolean
        }
        Insert: {
          id: string
          user_id: string
          name: string
          barcode?: string | null
          price?: number
          stock_warning?: number
          category?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          barcode?: string | null
          price?: number
          stock_warning?: number
          category?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
        }
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
