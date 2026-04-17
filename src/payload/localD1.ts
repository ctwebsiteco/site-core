// Local D1 shim backed by better-sqlite3. Used as a dev-mode fallback when
// the Cloudflare Worker context is unavailable (plain `next dev` / sandbox).
// Implements the subset of the D1Database interface that
// @payloadcms/db-d1-sqlite (via drizzle-orm/d1) actually calls — prepare,
// bind, run, all, first, raw, batch, exec.
//
// Schema + migrations are identical to production — this is the same D1
// adapter, just pointed at a local SQLite file instead of a live D1.

import type {
  D1Database,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
  D1Response,
} from '@cloudflare/workers-types'

type BetterSqliteDatabase = {
  prepare(sql: string): BetterSqliteStatement
  exec(sql: string): void
  transaction<T>(fn: () => T): () => T
  pragma(statement: string): unknown
  close(): void
}

type BetterSqliteStatement = {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
  all(...params: unknown[]): unknown[]
  get(...params: unknown[]): unknown
  raw(toggle?: boolean): BetterSqliteStatement
  columns(): { name: string }[]
  /** false for DDL + non-RETURNING DML; true for SELECT and RETURNING queries. */
  reader: boolean
}

function emptyMeta(): D1Result['meta'] {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
    served_by: 'local',
    served_by_region: '',
    served_by_primary_region: '',
    timings: { sql_duration_ms: 0 },
  }
}

class LocalD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly db: BetterSqliteDatabase,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    const normalized = values.map((v) =>
      typeof v === 'bigint' ? v : v === undefined ? null : v,
    )
    return new LocalD1PreparedStatement(this.db, this.sql, normalized)
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql)
    if (!stmt.reader) {
      // Non-SELECT (DDL, INSERT without RETURNING) — no row to return.
      stmt.run(...this.params)
      return null
    }
    const row = stmt.get(...this.params) as Record<string, unknown> | undefined
    if (!row) return null
    if (colName) return ((row[colName] ?? null) as T)
    return row as T
  }

  async run<T = Record<string, unknown>>(): Promise<D1Response & D1Result<T>> {
    const stmt = this.db.prepare(this.sql)
    const info = stmt.run(...this.params)
    const meta = emptyMeta()
    meta.changes = info.changes
    meta.rows_written = info.changes
    meta.last_row_id =
      typeof info.lastInsertRowid === 'bigint'
        ? Number(info.lastInsertRowid)
        : info.lastInsertRowid
    meta.changed_db = info.changes > 0
    return { success: true, meta, results: [] as T[] }
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql)
    if (!stmt.reader) {
      // Drizzle calls .all() on DDL (CREATE TABLE, DROP TABLE) and on
      // INSERTs without RETURNING. better-sqlite3's .all() rejects these
      // — route them through .run() and return empty results.
      const info = stmt.run(...this.params)
      const meta = emptyMeta()
      meta.changes = info.changes
      meta.rows_written = info.changes
      meta.last_row_id =
        typeof info.lastInsertRowid === 'bigint'
          ? Number(info.lastInsertRowid)
          : info.lastInsertRowid
      meta.changed_db = info.changes > 0
      return { success: true, meta, results: [] as T[] }
    }
    const rows = stmt.all(...this.params) as T[]
    const meta = emptyMeta()
    meta.rows_read = rows.length
    return { success: true, meta, results: rows }
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
    const stmt = this.db.prepare(this.sql)
    if (!stmt.reader) {
      stmt.run(...this.params)
      return []
    }
    const rawStmt = stmt.raw(true)
    const rows = rawStmt.all(...this.params) as T[]
    if (options?.columnNames) {
      const cols = rawStmt.columns().map((c) => c.name)
      return [cols as unknown as T, ...rows]
    }
    return rows
  }
}

class LocalD1Database implements Partial<D1Database> {
  constructor(private readonly db: BetterSqliteDatabase) {}

  prepare(sql: string): D1PreparedStatement {
    return new LocalD1PreparedStatement(this.db, sql)
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    const runAll = this.db.transaction(() => {
      const results: D1Result<T>[] = []
      for (const s of statements) {
        const inner = s as LocalD1PreparedStatement
        const stmt = this.db.prepare((inner as any).sql)
        const params = (inner as any).params as unknown[]
        const info = stmt.run(...params)
        const meta = emptyMeta()
        meta.changes = info.changes
        meta.rows_written = info.changes
        meta.last_row_id =
          typeof info.lastInsertRowid === 'bigint'
            ? Number(info.lastInsertRowid)
            : info.lastInsertRowid
        results.push({ success: true, meta, results: [] as T[] })
      }
      return results
    })
    return runAll()
  }

  async exec(query: string): Promise<D1ExecResult> {
    const start = performance.now()
    const statements = query
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    for (const stmt of statements) {
      this.db.exec(stmt + ';')
    }
    return {
      count: statements.length,
      duration: performance.now() - start,
    }
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error(
      '[site-core] LocalD1Database.dump() is not implemented — use wrangler against the real D1 for production dumps.',
    )
  }

  withSession(): never {
    throw new Error(
      '[site-core] LocalD1Database.withSession() is not implemented — no session replication in local dev.',
    )
  }
}

export async function createLocalD1(filePath: string): Promise<D1Database> {
  // Import lazily so consumers that never hit the dev fallback don't need
  // better-sqlite3 installed (native build / prebuild pull is non-trivial).
  let Database: typeof import('better-sqlite3').default
  try {
    const mod = await import('better-sqlite3')
    Database = (mod.default ?? mod) as typeof import('better-sqlite3').default
  } catch (err) {
    throw new Error(
      '[site-core] Local SQLite fallback requires `better-sqlite3` as a dependency. ' +
      'Install it in the consumer: `bun add -d better-sqlite3` (or pnpm / npm). ' +
      `Original error: ${(err as Error).message}`,
    )
  }

  // Ensure the parent directory exists.
  const { mkdirSync } = await import('node:fs')
  const path = await import('node:path')
  mkdirSync(path.dirname(filePath), { recursive: true })

  const db = new Database(filePath) as unknown as BetterSqliteDatabase
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return new LocalD1Database(db) as unknown as D1Database
}
