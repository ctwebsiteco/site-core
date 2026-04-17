import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// src/supabase/middleware.ts
var DEFAULT_GUARDED_PREFIXES = ["/admin"];
var DEFAULT_AUTH_PATHS = ["/auth/login", "/auth/callback", "/auth/logout"];
async function updateSession(request, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }
  const guardedPrefixes = options.guardedPrefixes ?? DEFAULT_GUARDED_PREFIXES;
  const authPaths = options.authPaths ?? DEFAULT_AUTH_PATHS;
  const loginPath = options.loginPath ?? "/auth/login";
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(
          ({ name, value }) => request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(
          ({ name, value, options: options2 }) => response.cookies.set(name, value, options2)
        );
      }
    }
  });
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.warn(
      "[site-core] Supabase auth check failed, passing request through:",
      err.message
    );
    return NextResponse.next({ request });
  }
  const { pathname } = request.nextUrl;
  const isGuarded = guardedPrefixes.some((p) => pathname.startsWith(p));
  const isAuth = authPaths.some((p) => pathname.startsWith(p));
  if (isGuarded && !isAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.searchParams.set("returnTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return response;
}

export { updateSession };
//# sourceMappingURL=middleware.js.map
//# sourceMappingURL=middleware.js.map