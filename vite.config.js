import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Using function form, destructuring the command parameter
export default defineConfig(({ command }) => {
  // Determine if we're in development (serve) or build environment
  const isProduction = command === 'build';

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    // Core modification here:
    // If it's a production build, use '/repository-name/'
    // If it's local development, use '/'
    base: './',
    
    // Build optimizations
    build: {
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      
      // Manual chunking for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'vue-vendor': ['vue', 'vue-router'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'xlsx': ['xlsx'],
            
            // UI components
            'ui-components': [
              './src/components/Toast.vue',
              './src/components/Dialog.vue'
            ],
            
            // Views (split each view into its own chunk)
            'inbox-view': ['./src/views/InboxView.vue'],
            'inventory-view': ['./src/views/InventoryView.vue'],
            'sales-view': ['./src/views/SalesView.vue'],
            'dashboard-view': ['./src/views/DashboardView.vue'],
            'settings-view': ['./src/views/SettingsView.vue']
          }
        }
      }
    },
    
    // Development optimizations
    server: {
      // Enable compression in dev mode
      compress: true,
      
      // Optimize deps
      optimizeDeps: {
        include: ['vue', '@supabase/supabase-js', 'xlsx']
      }
    }
  }
})