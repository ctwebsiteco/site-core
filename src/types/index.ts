// Ambient CloudflareEnv augmentation. Importing this module has side-effects
// (global type augmentation), which is intentional — callers do:
//   import '@ctwebsiteco/site-core/types'
// from their tsconfig's `types` array or from any .d.ts entry so that
// getCloudflareContext().env.DB / .MEDIA are typed.
import './env'

// Re-export the JWT claim types for consumers that don't import /auth.
export type { ClientClaim, SupabaseClaims } from '../auth/verifyJwt'
export type { ShadowRole } from '../auth/shadowUser'
