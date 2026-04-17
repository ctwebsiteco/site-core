import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

// Middleware helper — refreshes the access token (when possible) and
// guards /admin requests that arrive without a valid session.
//
// Dev-mode contract: if SUPABASE_URL and SUPABASE_ANON_KEY are BOTH unset,
// auth enforcement is disabled and every request passes through. This lets
// a developer run the template locally without any env file, so `pnpm dev`
// works end-to-end for frontend iteration and seeding.
//
// Production: once either env is set, enforcement is on. If both are set and
// Supabase can't be reached (DNS, network, rate limit) the request is ALSO
// passed through — we don't want a transient Supabase outage to lock every
// editor out of /admin. Log the failure so it's visible.

const DEFAULT_GUARDED_PREFIXES = ['/admin']
const DEFAULT_AUTH_PATHS = ['/auth/login', '/auth/callback', '/auth/logout']

export type UpdateSessionOptions = {
  /** Path prefixes that require an authenticated Supabase session. */
  guardedPrefixes?: string[]
  /** Paths that must be allowed through even when unauthenticated. */
  authPaths?: string[]
  /** Where to redirect unauthenticated users. Defaults to /auth/login. */
  loginPath?: string
}

export async function updateSession(
  request: NextRequest,
  options: UpdateSessionOptions = {},
) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  // Dev bypass: no Supabase configured → no auth, pass through.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  const guardedPrefixes = options.guardedPrefixes ?? DEFAULT_GUARDED_PREFIXES
  const authPaths = options.authPaths ?? DEFAULT_AUTH_PATHS
  const loginPath = options.loginPath ?? '/auth/login'

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Silent refresh — reads current cookies, refreshes if needed, writes new ones.
  // A Supabase outage / misconfig must not lock editors out; log and pass through.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.warn(
      '[site-core] Supabase auth check failed, passing request through:',
      (err as Error).message,
    )
    return NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl
  const isGuarded = guardedPrefixes.some((p) => pathname.startsWith(p))
  const isAuth = authPaths.some((p) => pathname.startsWith(p))

  if (isGuarded && !isAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = loginPath
    url.searchParams.set('returnTo', pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return response
}
