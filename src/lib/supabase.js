import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si les clés ne sont pas fournies, l'app tourne en mode local
// (données dans le navigateur uniquement). Pratique pour tester.
export const supabase = url && key
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null

export const isCloud = Boolean(supabase)
