import type { KivaConfig } from '../config';
import { getSupabase } from './supabase';

export async function fetchIsAdmin(config: KivaConfig, userId: string): Promise<boolean> {
  const supabase = getSupabase(config);
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Could not load profile', error.message);
    return false;
  }

  return Boolean(data?.is_admin);
}
