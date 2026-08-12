import { createClient } from '@supabase/supabase-js';

// Use environment variables supported by your framework
// Common names:
// - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// - REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Warn at runtime but don't throw — allows devs to run other parts of the app
  // without Supabase configured.
  // Set the env vars before testing the integration.
  console.warn('Supabase URL or ANON key not set. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
