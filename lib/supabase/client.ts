import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: ReturnType<typeof createClient<Database>> | undefined;

// Cliente singleton: conserva la sesión en localStorage entre navegación y recargas.
export const supabase = () => client ??= createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
