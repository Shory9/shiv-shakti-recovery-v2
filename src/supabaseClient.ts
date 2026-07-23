import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL ya Anon Key missing hai. .env file check karo."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);