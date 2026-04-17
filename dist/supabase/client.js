'use client';
import { createBrowserClient } from '@supabase/ssr';

// src/supabase/client.ts
function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export { createClient };
//# sourceMappingURL=client.js.map
//# sourceMappingURL=client.js.map