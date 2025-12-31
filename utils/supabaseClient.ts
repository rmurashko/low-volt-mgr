import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Debugging: Print to terminal to see if keys exist
console.log("Supabase URL:", supabaseUrl)
console.log("Supabase Key:", supabaseKey ? "Found" : "Missing")

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Key is missing. Check .env.local file.")
}

export const supabase = createClient(supabaseUrl, supabaseKey)