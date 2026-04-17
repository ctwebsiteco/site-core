import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Browser-side Supabase client. The `'use client'` directive is injected
// by tsup's banner (see tsup.config.ts) rather than embedded here, so the
// bundler doesn't warn about module-level directives being stripped.
// Consumers import via `@ctwebsiteco/site-core/supabase/client`.

export function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
