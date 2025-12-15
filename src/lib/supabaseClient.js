import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if required environment variables are available
const hasSupabaseConfig = supabaseUrl && supabaseAnonKey

let client;

if (hasSupabaseConfig) {
  // Use real Supabase client when config is available
  client = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Create a mock client when running in environments without Supabase config (e.g., GitHub Pages)
  console.warn('⚠️ Supabase configuration not found. Running in offline mode.')
  
  // Mock Supabase client with same interface but no actual backend
  client = {
    from: (table) => {
      return {
        select: (columns = '*') => {
          console.log(`Mock Supabase: select from ${table}`)
          return {
            eq: (column, value) => {
              return {
                order: (column, options) => {
                  // Return empty array for all queries in mock mode
                  return Promise.resolve({ data: [], error: null })
                },
                gte: (column, value) => {
                  return {
                    lte: (column, value) => {
                      return Promise.resolve({ data: [], error: null })
                    }
                  }
                },
                limit: (limit) => {
                  return Promise.resolve({ data: [], error: null })
                }
              }
            },
            order: (column, options) => {
              return Promise.resolve({ data: [], error: null })
            },
            limit: (limit) => {
              return Promise.resolve({ data: [], error: null })
            }
          }
        },
        insert: (data) => {
          console.log(`Mock Supabase: insert to ${table}`, data)
          return Promise.resolve({ data: Array.isArray(data) ? data : [data], error: null })
        },
        update: (data) => {
          console.log(`Mock Supabase: update in ${table}`, data)
          return {
            eq: (column, value) => {
              return {
                select: () => {
                  return Promise.resolve({ data: Array.isArray(data) ? data : [data], error: null })
                }
              }
            }
          }
        },
        upsert: (data) => {
          console.log(`Mock Supabase: upsert in ${table}`, data)
          return Promise.resolve({ data: Array.isArray(data) ? data : [data], error: null })
        },
        delete: () => {
          console.log('Mock Supabase: delete operation')
          return {
            eq: (column, value) => {
              return Promise.resolve({ data: [], error: null })
            }
          }
        }
      }
    },
    auth: {
      signInWithPassword: (credentials) => {
        console.log('Mock Supabase: signInWithPassword', credentials)
        return Promise.resolve({ data: { user: { id: 'mock-user', email: 'mock@example.com' } }, error: null })
      },
      signUp: (credentials) => {
        console.log('Mock Supabase: signUp', credentials)
        return Promise.resolve({ data: { user: { id: 'mock-user', email: 'mock@example.com' } }, error: null })
      },
      signOut: () => {
        console.log('Mock Supabase: signOut')
        return Promise.resolve({ error: null })
      },
      getUser: () => {
        console.log('Mock Supabase: getUser')
        return Promise.resolve({ data: { user: { id: 'mock-user', email: 'mock@example.com' } }, error: null })
      },
      onAuthStateChange: (callback) => {
        console.log('Mock Supabase: onAuthStateChange')
        // Immediately call back with mock user
        setTimeout(() => callback('SIGNED_IN', { user: { id: 'mock-user', email: 'mock@example.com' } }), 0)
        return { data: { subscription: { unsubscribe: () => {} } } }
      }
    }
  }
}

export const supabase = client