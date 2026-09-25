import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SUPABASE_URL } from './orbTables.js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.ORB_SUPABASE_SYNC_KEY

/** Null quando não há anon key (app local-first ainda funciona via SQLite). */
export const supabase =
  supabaseUrl &&
  supabaseKey &&
  String(supabaseUrl).startsWith('http')
    ? createClient(supabaseUrl, supabaseKey)
    : null
