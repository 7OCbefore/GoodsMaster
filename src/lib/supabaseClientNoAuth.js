import { createClient } from '@supabase/supabase-js'

// Default user ID for non-authenticated system
const DEFAULT_USER_ID = 'default-user-id';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auto-sign in with default user for development
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    // Add default headers that may help with auth bypass in development
    headers: {
      'X-Default-User-ID': DEFAULT_USER_ID
    }
  }
})

// Function to get default user ID
export const getDefaultUserId = () => DEFAULT_USER_ID;