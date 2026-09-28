export interface KivaConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function loadConfig(): KivaConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  };
}

export function isSupabaseConfigured(config: KivaConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
