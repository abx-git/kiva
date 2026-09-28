import type { KivaConfig } from '../config';
import { getSupabase } from '../lib/supabase';

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

export async function signInWithPassword(
  config: KivaConfig,
  email: string,
  password: string,
): Promise<LoginResult> {
  const supabase = getSupabase(config);
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured. See kiva/.env.example.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function signOut(config: KivaConfig): Promise<void> {
  const supabase = getSupabase(config);
  if (supabase) await supabase.auth.signOut();
}
