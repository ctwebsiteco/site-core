import { getPayload as getPayloadBase, type SanitizedConfig } from 'payload'
import { createMockPayload, type MockFixtures, type MockPayload } from './mockPayload'

type PayloadInstance = Awaited<ReturnType<typeof getPayloadBase>>

// Memoized factory for the `getPayload()` consumers call from frontend
// code. Two modes:
//
//   1. config is a real SanitizedConfig (prod / wrangler dev):
//      returns a singleton-cached real Payload instance.
//
//   2. config is null and `fixtures` is provided (dev sandbox / next dev
//      without Cloudflare context): returns a fixture-backed mock that
//      satisfies the methods the template's frontend calls (find,
//      findGlobal, findByID). No DB, no native deps, no Payload init.
//
// Consumers always call `await getPayload()` — the mode is opaque from
// their perspective. Same shape returned in both worlds.

type CreateGetPayloadResult = () => Promise<PayloadInstance | MockPayload>

export function createGetPayload(
  config: SanitizedConfig | null | Promise<SanitizedConfig | null>,
  fixtures?: MockFixtures,
): CreateGetPayloadResult {
  let cached: PayloadInstance | MockPayload | undefined

  return async () => {
    if (cached) return cached

    const resolved = await config

    if (resolved === null) {
      if (!fixtures) {
        throw new Error(
          '[site-core] createGetPayload called with null config and no fixtures. ' +
          'Either provide fixtures (dev) or run with a real Cloudflare context (prod / pnpm preview).',
        )
      }
      cached = createMockPayload(fixtures)
      return cached
    }

    cached = await getPayloadBase({ config: resolved })
    return cached
  }
}
