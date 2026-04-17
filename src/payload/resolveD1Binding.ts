import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { D1Database } from '@cloudflare/workers-types'
import { createLocalD1 } from './localD1'

// Resolves the D1 binding from the Worker env.
//
// Three call-time outcomes:
//   1. Real Worker runtime (prod) — returns the D1Database binding.
//   2. `next dev` with initOpenNextCloudflareForDev() run — returns a
//      Miniflare-backed local D1 binding.
//   3. No Cloudflare context reachable (sandbox, SKIP_CLOUDFLARE_DEV_INIT,
//      missing workerd, plain Node) — returns a LOCAL SQLite-backed D1
//      shim pointed at `<LOCAL_D1_PATH or .payload/local.db>`. Same
//      @payloadcms/db-d1-sqlite adapter consumes it; schema + migrations
//      are identical to prod. Agents can edit + save content locally;
//      deploying to Cloudflare swaps the binding with zero code change.
//
// Override the local path by setting LOCAL_D1_PATH (e.g. ':memory:' for
// ephemeral in-memory mode — useful for tests).

type EnvWithDB = { DB?: unknown }

export async function resolveD1Binding(): Promise<D1Database> {
  // Explicit opt-in to the local SQLite path, even when Cloudflare context
  // is available. Handy for offline dev, sandbox test runs, or debugging
  // differences between Miniflare-D1 and the LocalD1 shim.
  if (process.env.FORCE_LOCAL_D1 === 'true' || process.env.FORCE_LOCAL_D1 === '1') {
    console.warn(
      '[site-core] FORCE_LOCAL_D1 set — using local SQLite at LOCAL_D1_PATH or .payload/local.db.',
    )
    return createLocalD1(process.env.LOCAL_D1_PATH ?? '.payload/local.db')
  }

  try {
    const ctx = await getCloudflareContext({ async: true })
    const env = ctx.env as unknown as EnvWithDB
    if (env.DB) {
      return env.DB as D1Database
    }
    console.warn(
      '[site-core] Cloudflare context resolved but env.DB is unbound — falling back to local SQLite.',
    )
  } catch (err) {
    console.warn(
      '[site-core] getCloudflareContext() threw — falling back to local SQLite at LOCAL_D1_PATH or .payload/local.db.',
      (err as Error).message,
    )
  }

  const localPath = process.env.LOCAL_D1_PATH ?? '.payload/local.db'
  return createLocalD1(localPath)
}
