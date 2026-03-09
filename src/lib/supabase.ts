import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Capture the initial hash at module load time — before Supabase auth initialization
// or any async code has a chance to modify window.location.
// This is the earliest possible moment we can snapshot the URL.
export const initialHash = typeof window !== 'undefined' ? window.location.hash : '';

export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});