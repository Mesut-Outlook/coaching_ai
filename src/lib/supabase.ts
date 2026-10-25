import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const env =
  (typeof import.meta !== 'undefined' && (import.meta as any).env)
    ? (import.meta as any).env
    : ((typeof globalThis !== 'undefined' && (globalThis as any).process?.env) || {})
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. ' +
      '.env.local dosyasını .env.example üzerinden oluştur.',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
