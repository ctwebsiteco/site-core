import type { AuthStrategy } from 'payload'
import { createServerClient } from '@supabase/ssr'
import { parseCookieHeader } from './cookieStore'
import { verifySupabaseJwt } from './verifyJwt'
import { findOrCreateShadowUser, resolveRole } from './shadowUser'

// Custom auth strategy for Payload. Source of truth = Supabase JWT.
// Admission = super_admin OR membership of this Worker's CLIENT_ID.
// On success, upserts a shadow user row in local D1 and returns it.
//
// Dev-mode contract: if the Supabase env is absent, we admit a synthetic
// super-admin user so local dev + seeding work without any env setup.
// Gate: SUPABASE_URL, SUPABASE_ANON_KEY, and CLIENT_ID must ALL be unset
// for the bypass to trigger — a partial config means "misconfigured,
// reject" rather than "dev mode".

export const supabaseStrategy: AuthStrategy = {
  name: 'supabase',
  authenticate: async ({ headers, payload }) => {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
    const clientId = process.env.CLIENT_ID

    const noSupabase = !supabaseUrl && !supabaseAnonKey && !clientId
    const partialSupabase = !noSupabase && (!supabaseUrl || !supabaseAnonKey || !clientId)

    if (partialSupabase) {
      // Misconfigured — fail closed.
      return { user: null }
    }

    if (noSupabase) {
      // Dev bypass. Admit a virtual super-admin. Intentionally does NOT
      // touch D1 (no shadow-user upsert) — local dev must work before any
      // Payload migration has created the users table. This is purely an
      // in-memory user that Payload treats as authenticated for the life
      // of the request.
      const now = new Date().toISOString()
      return {
        user: {
          id: 0,
          collection: 'users',
          supabaseId: 'dev-local',
          email: 'dev@local',
          role: 'super_admin',
          name: 'Local Dev',
          createdAt: now,
          updatedAt: now,
        } as any,
      }
    }

    const cookies = parseCookieHeader(headers.get('cookie'))

    // Use @supabase/ssr to pull the session out of the cookies. This also
    // handles silent refresh when the access token is near expiry.
    const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
      cookies: {
        getAll: () => cookies,
        // Auth strategy is read-only: we can't write Set-Cookie here.
        // Token refresh needs to happen via middleware on the request pipeline.
        setAll: () => {},
      },
    })

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) return { user: null }

    const claims = await verifySupabaseJwt(accessToken)
    if (!claims || !claims.sub) return { user: null }

    const admitted =
      claims.super_admin === true ||
      (Array.isArray(claims.clients) &&
        claims.clients.some((c) => c.id === clientId!))
    if (!admitted) return { user: null }

    const role = resolveRole(claims, clientId!)

    const shadowUser = await findOrCreateShadowUser(payload, {
      supabaseId: claims.sub,
      email: claims.email ?? sessionData.session!.user.email ?? '',
      role,
    })

    return {
      user: {
        ...shadowUser,
        collection: 'users',
      },
    }
  },
}
