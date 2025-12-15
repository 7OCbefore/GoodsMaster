import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const globalUserId = import.meta.env.VITE_GLOBAL_USER_ID;

if (!supabaseUrl || !supabaseAnonKey || !globalUserId) {
  console.warn('Supabase environment variables or global user ID are not set. Cloud sync will be disabled.');
}

export const supabase: SupabaseClient<Database> | null = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 检查是否配置了Supabase环境
export const isSupabaseConfigured = !!supabase;

// 获取当前用户（单租户模式下返回硬编码的用户ID）
export const getCurrentUser = () => {
  if (!globalUserId) {
    throw new Error('Global user ID is not configured');
  }
  return { id: globalUserId };
};