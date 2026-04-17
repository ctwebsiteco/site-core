import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { D1Database } from '@cloudflare/workers-types'

// Resolves the D1 binding from the Worker env.
//
// Three call-time outcomes:
//   1. Real Worker runtime (prod) — returns the D1Database binding.
//   2. `next dev` with initOpenNextCloudflareForDev() run — returns a
//      Miniflare-backed local D1 binding.
//   3. Any context where getCloudflareContext() throws (sandbox,
//      SKIP_CLOUDFLARE_DEV_INIT=true, etc.) — returns a PROXY that
//      impersonates D1Database but throws a clear error on any method
//      call. This lets Payload config load at import time so the Next
//      server boots; actual DB queries (e.g. loading /admin) fail with
//      "D1 binding unavailable" instead of crashing at startup.

type EnvWithDB = { DB?: unknown }

function createFailingProxy(reason: string): D1Database {
  const err = () => {
    throw new Error(
      `D1 binding "DB" unavailable: ${reason}. ` +
      `Run \`pnpm preview\` (wrangler dev) for a real binding, or set ` +
      `SKIP_CLOUDFLARE_DEV_INIT=false in your env to enable Miniflare proxy.`,
    )
  }
  return new Proxy({} as D1Database, {
    get: () => err,
    apply: () => err(),
  })
}

export async function resolveD1Binding(): Promise<D1Database> {
  let env: EnvWithDB
  try {
    const ctx = await getCloudflareContext({ async: true })
    env = ctx.env as unknown as EnvWithDB
  } catch (err) {
    console.warn(
      '[site-core] getCloudflareContext() threw — returning a failing D1 proxy. ' +
      'This is expected when SKIP_CLOUDFLARE_DEV_INIT=true or when the host ' +
      'cannot run workerd. DB queries will fail with a clear message.',
      (err as Error).message,
    )
    return createFailingProxy((err as Error).message)
  }

  if (!env.DB) {
    return createFailingProxy('env.DB not bound')
  }
  return env.DB as D1Database
}
