import type { Payload } from 'payload'
import type { ClientClaim, SupabaseClaims } from './verifyJwt'

export type ShadowRole = 'super_admin' | 'owner' | 'editor'

export function resolveRole(claims: SupabaseClaims, clientId: string): ShadowRole {
  if (claims.super_admin === true) return 'super_admin'
  const match = claims.clients?.find((c: ClientClaim) => c.id === clientId)
  return (match?.role as ShadowRole) ?? 'editor'
}

type ShadowUserInput = {
  supabaseId: string
  email: string
  role: ShadowRole
  name?: string
}

export async function findOrCreateShadowUser(
  payload: Payload,
  input: ShadowUserInput,
) {
  const existing = await payload.find({
    collection: 'users',
    where: { supabaseId: { equals: input.supabaseId } },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length > 0) {
    const current = existing.docs[0] as any
    const needsUpdate =
      current.email !== input.email ||
      current.role !== input.role ||
      (input.name && current.name !== input.name)

    if (needsUpdate) {
      return payload.update({
        collection: 'users',
        id: current.id,
        data: {
          email: input.email,
          role: input.role,
          ...(input.name ? { name: input.name } : {}),
        },
      })
    }
    return current
  }

  return payload.create({
    collection: 'users',
    data: {
      supabaseId: input.supabaseId,
      email: input.email,
      role: input.role,
      ...(input.name ? { name: input.name } : {}),
    },
  })
}
