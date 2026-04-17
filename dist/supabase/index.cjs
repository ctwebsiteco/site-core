'use strict';

var ssr = require('@supabase/ssr');
var headers = require('next/headers');

// src/supabase/index.ts
async function createClient() {
  const cookieStore = await headers.cookies();
  return ssr.createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => cookieStore.set(name, value, options)
            );
          } catch {
          }
        }
      }
    }
  );
}

exports.createClient = createClient;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map