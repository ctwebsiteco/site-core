import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

// Custom claims injected by the Supabase access-token hook (see
// supabase/migrations/20260417120600_auth_hook.sql).
export type ClientClaim = {
  id: string
  slug: string
  role: 'owner' | 'editor'
}

export type SupabaseClaims = JWTPayload & {
  email?: string
  super_admin?: boolean
  clients?: ClientClaim[]
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined
let cachedJwksUrl: string | undefined

function getJwks(jwksUrl: string) {
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    })
    cachedJwksUrl = jwksUrl
  }
  return cachedJwks
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseClaims | null> {
  const jwksUrl = process.env.SUPABASE_JWKS_URL
  if (!jwksUrl) {
    throw new Error('SUPABASE_JWKS_URL is not set')
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(jwksUrl), {
      audience: 'authenticated',
    })
    return payload as SupabaseClaims
  } catch {
    return null
  }
}
