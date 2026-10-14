import { createClient } from '@supabase/supabase-js'

// These come from your .env file (see Phase 0).
// Vite only exposes variables that start with VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env variables. Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart "npm run dev".',
  )
}

// One shared client for the whole app.
// Row Level Security protects the data, so the anon key is safe in the browser.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)