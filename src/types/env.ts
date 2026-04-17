// Cloudflare Worker bindings exposed to the Next.js runtime via
// @opennextjs/cloudflare's getCloudflareContext().env.
// Matches the bindings declared in wrangler.toml.

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'

declare global {
  interface CloudflareEnv {
    DB: D1Database
    MEDIA: R2Bucket
  }
}

export {}
