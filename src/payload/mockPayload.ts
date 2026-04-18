// Lightweight Payload-shaped mock for dev mode without a database.
//
// Reads directly from a fixtures object (typically src/seed/fixtures.ts in
// the consumer template). Implements only the methods the template's
// frontend code calls — `find`, `findGlobal`, `findByID`. Anything else
// throws a clear error pointing the developer at `pnpm preview` (real
// Payload + Cloudflare context).
//
// Why a mock instead of a SQLite shim?
//
// Agents customizing the visual layer don't need a working CMS — they
// need to see their seed data render. Skipping Payload init entirely
// removes the schema-sync step (~10s), the native-dep install
// (better-sqlite3), and the local DB clutter (.payload/local.db). Boot
// time goes from ~15s to ~1s.

export type MockFixtures = {
  /** Map of collection slug → array of docs. */
  collections?: Record<string, Array<Record<string, any>>>
  /** Map of global slug → doc. */
  globals?: Record<string, Record<string, any>>
}

type WhereClause = Record<string, { equals?: unknown; in?: unknown[] }>

function matches(doc: Record<string, any>, where?: WhereClause): boolean {
  if (!where) return true
  for (const [field, condition] of Object.entries(where)) {
    const value = doc[field]
    if (condition.equals !== undefined && value !== condition.equals) return false
    if (condition.in !== undefined && !condition.in.includes(value)) return false
  }
  return true
}

function unsupported(method: string): never {
  throw new Error(
    `[site-core] mockPayload.${method}() is not implemented in dev fixture mode. ` +
    `Run \`pnpm preview\` (wrangler) for real Payload + D1 if you need this method locally.`,
  )
}

export function createMockPayload(fixtures: MockFixtures) {
  const collections = fixtures.collections ?? {}
  const globals = fixtures.globals ?? {}

  return {
    async find({
      collection,
      where,
      limit = 10,
      page = 1,
      depth: _depth = 0,
    }: {
      collection: string
      where?: WhereClause
      limit?: number
      page?: number
      depth?: number
    }) {
      const all = collections[collection] ?? []
      const matched = all.filter((d) => matches(d, where))
      const start = (page - 1) * limit
      const docs = matched.slice(start, start + limit)
      const totalDocs = matched.length
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
      return {
        docs,
        totalDocs,
        limit,
        page,
        totalPages,
        pagingCounter: start + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      }
    },

    async findByID({ collection, id }: { collection: string; id: string | number }) {
      const all = collections[collection] ?? []
      return all.find((d) => d.id === id) ?? null
    },

    async findGlobal({ slug, depth: _depth = 0 }: { slug: string; depth?: number }) {
      return globals[slug] ?? null
    },

    // Surface methods that may be called but aren't implemented — clearly
    // signal "not supported in dev fixture mode" instead of silently
    // returning undefined.
    create: () => unsupported('create'),
    update: () => unsupported('update'),
    delete: () => unsupported('delete'),
    updateGlobal: () => unsupported('updateGlobal'),
    sendEmail: async () => {
      console.warn('[site-core] mockPayload.sendEmail noop in dev fixture mode')
    },
  }
}

export type MockPayload = ReturnType<typeof createMockPayload>
