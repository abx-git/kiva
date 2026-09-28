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
    return { ok: false, message: mapAuthError(error.message) };
  }
  return { ok: true };
}

function mapAuthError(message: string): string {
  if (/database error querying schema/i.test(message)) {
    return (
      'Login failed: the user row in Supabase Auth is invalid (often after manual SQL). ' +
      'Run supabase/kiva/test-user.sql (UPDATE block) in the SQL Editor, or create the user under Authentication → Users.'
    );
  }
  return message;
}

export async function signOut(config: KivaConfig): Promise<void> {
  const supabase = getSupabase(config);
  if (supabase) await supabase.auth.signOut();
}
