'use client';
'use strict';

var ssr = require('@supabase/ssr');

// src/supabase/client.ts
function createClient() {
  return ssr.createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

exports.createClient = createClient;
//# sourceMappingURL=client.cjs.map
//# sourceMappingURL=client.cjs.map