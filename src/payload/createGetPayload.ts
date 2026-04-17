import { getPayload as getPayloadBase, type SanitizedConfig } from 'payload'

type PayloadInstance = Awaited<ReturnType<typeof getPayloadBase>>

// Factory returning a memoized `getPayload()` bound to a specific config.
// Consumers (the per-client template) import their config via the
// @payload-config Next alias and pass it here.

export function createGetPayload(
  config: SanitizedConfig | Promise<SanitizedConfig>,
): () => Promise<PayloadInstance> {
  let cached: PayloadInstance | undefined

  return async () => {
    if (!cached) {
      cached = await getPayloadBase({ config: await config })
    }
    return cached
  }
}
