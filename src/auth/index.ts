export { parseCookieHeader, type ParsedCookie } from './cookieStore'
export {
  verifySupabaseJwt,
  type ClientClaim,
  type SupabaseClaims,
} from './verifyJwt'
export {
  findOrCreateShadowUser,
  resolveRole,
  type ShadowRole,
} from './shadowUser'
export { supabaseStrategy } from './supabaseStrategy'
