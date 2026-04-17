import { SupabaseClient } from '@supabase/supabase-js';

declare function createClient(): Promise<SupabaseClient>;

export { createClient };
