import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { KivaConfig } from '../config';

let client: SupabaseClient | null = null;

export function getSupabase(config: KivaConfig): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export async function getSession(config: KivaConfig): Promise<Session | null> {
  const supabase = getSupabase(config);
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  config: KivaConfig,
  callback: (session: Session | null) => void,
): () => void {
  const supabase = getSupabase(config);
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
