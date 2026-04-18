import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { D1Database } from '@cloudflare/workers-types'

// Resolves the D1 binding from the Worker env.
//
// Two outcomes:
//   1. Cloudflare context available → returns env.DB (real D1 in prod,
//      Miniflare-D1 in `pnpm preview` / wrangler dev).
//   2. No Cloudflare context → throws. Consumers (template's
//      payload.config.ts) catch this and skip Payload init; the template
//      uses createMockPayload(fixtures) for dev rendering instead. See
//      createGetPayload.ts.
//
// We intentionally do NOT fall back to a local SQLite — agents don't
// need a working CMS in the sandbox; they need to see fixtures render.
// SQLite added native deps + boot time we no longer pay.

type EnvWithDB = { DB?: unknown }

export async function resolveD1Binding(): Promise<D1Database> {
  const ctx = await getCloudflareContext({ async: true })
  const env = ctx.env as unknown as EnvWithDB
  if (!env.DB) {
    throw new Error(
      'D1 binding "DB" not bound on Cloudflare context — check wrangler.toml.',
    )
  }
  return env.DB as D1Database
}
