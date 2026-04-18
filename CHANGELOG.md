# Changelog

All notable changes to `@ctwebsiteco/site-core` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning: [Semantic Versioning](https://semver.org/).

Each entry may include a `Fleet impact:` line when the change affects
runtime behavior that depends on the shared Supabase fleet schema —
consumers must coordinate a migration or a particular JWT hook version.

## [Unreleased]

## [0.3.0] — 2026-04-18

### Removed (BREAKING) — SQLite shim, FORCE_LOCAL_D1, LOCAL_D1_PATH

After research against Cloudflare's own Sept 2025 Payload-on-Workers
guide and Payload's official SQLite adapter docs, the better-sqlite3
"D1 mock" we shipped in 0.2.0 was a workaround. The right pattern for
agent-driven dev (visual-layer customization, not CMS authoring) is
to skip Payload init entirely in dev and render the frontend from
fixture data — no DB at any layer.

- **DELETED** `src/payload/localD1.ts` (~150 lines).
- **DELETED** `FORCE_LOCAL_D1` and `LOCAL_D1_PATH` env handling.
- **REMOVED** `better-sqlite3` peerDep + `peerDependenciesMeta`. No
  more native build, no more trustedDependencies whitelisting in the
  template.

### Added — fixture-mock dev mode

- **`src/payload/mockPayload.ts`**: `createMockPayload(fixtures)`
  returns a Payload-shaped object that satisfies the methods the
  template's frontend calls (`find`, `findGlobal`, `findByID`).
  `where: { field: { equals } | { in } }` supported. Other methods
  (`create`, `update`, `delete`, `updateGlobal`) throw a clear error
  pointing at `pnpm preview`.
- **`createGetPayload(config, fixtures?)`**: now accepts an optional
  fixtures arg. If config resolves to `null` (no Cloudflare context)
  and fixtures are provided → returns the mock. Otherwise → real
  Payload singleton as before. Mode is opaque to consumers.
- **`createPayloadConfig`**: returns `null` instead of throwing when
  `resolveD1Binding` fails. The template's `getPayload()` catches
  this transparently. /admin won't render in this state — that's
  intentional, agents don't need /admin in the sandbox.

### Why

- **Boot time**: `next dev` ready in ~700ms (was ~15s with SQLite +
  schema sync).
- **Install time**: `bun install` ~30s (was ~115s with native
  better-sqlite3 compile).
- **Code surface**: -150 lines in site-core, -10 lines of trustedDeps
  + native-build wiring in template. Nothing to maintain.
- **Schema drift**: zero — frontend never touches a DB in dev, so
  there's no schema to keep in sync between dev SQLite and prod D1.

### Migration

Consumer template's `getPayload.ts` must be updated:

```diff
- import config from '@payload-config'
- import { createGetPayload } from '@ctwebsiteco/site-core/payload'
- export const getPayload = createGetPayload(config)
+ import config from '@payload-config'
+ import { fixtures } from '@/seed/fixtures'
+ import { createGetPayload } from '@ctwebsiteco/site-core/payload'
+ export const getPayload = createGetPayload(config, fixtures)
```

The `fixtures` shape is `{ collections: { [slug]: doc[] }, globals: { [slug]: doc } }`.
See template's `src/seed/fixtures.ts` for the canonical layout.

### Fleet impact: none. JWT shape, fleet schema, prod runtime all unchanged.



## [0.2.0] — 2026-04-17

### Breaking? No — runtime contract unchanged, but dev behavior is now much more useful.

### Added — real SQLite dev backend (replaces the failing-proxy fallback)

`resolveD1Binding` now returns a fully-functional D1-shaped binding
backed by `better-sqlite3` when the Cloudflare Worker context is
unreachable. Previously it returned a Proxy that threw on every method
call — the Next server booted but every `/admin` query errored.

- **New file**: `src/payload/localD1.ts` — `LocalD1Database` +
  `LocalD1PreparedStatement` implement the subset of the D1 interface
  that `@payloadcms/db-d1-sqlite` (via drizzle-orm/d1) uses: `prepare`,
  `bind`, `first`, `run`, `all`, `raw`, `batch`, `exec`.
- `.all()` and `.first()` auto-route DDL + non-RETURNING DML through
  better-sqlite3's `.run()` (it rejects `.all()` on statements that
  don't return rows; drizzle emits these for `CREATE TABLE`, `DROP
  TABLE`, `INSERT` without `RETURNING`).
- Default local path: `.payload/local.db` (gitignored in the template).
  Override with `LOCAL_D1_PATH` env (e.g. `:memory:` for ephemeral
  in-memory dev, or any absolute path).
- Same `@payloadcms/db-d1-sqlite` adapter handles both prod (real D1)
  and dev (LocalD1). Schema + migrations identical.

### Added — `FORCE_LOCAL_D1` env

Opt-in to the SQLite shim even when Cloudflare context IS available.
Useful when Miniflare-D1 state is corrupted, or for fully-offline dev
runs. Set `FORCE_LOCAL_D1=true` or `=1`.

### Peer dependencies

- `better-sqlite3 >=11.0.0` (marked optional via
  `peerDependenciesMeta.better-sqlite3.optional = true` — consumers
  that never hit the dev fallback path don't need it).

### Verified end-to-end

`next dev` with `FORCE_LOCAL_D1=true`, no Supabase env, no Cloudflare
bindings:

1. Start `next dev` — server ready in ~800ms
2. `GET /admin` → 200, Payload dashboard renders
3. `POST /api/pages {"title":"Hello SQLite","slug":"hello"}` → 201,
   returns `{"doc":{"id":1,"title":"Hello SQLite",...}}`
4. `GET /api/pages` → returns the created page

All schema DDL, writes, and reads go through the shim. `.payload/local.db`
created on disk with WAL + SHM journals.

### Fleet impact: none. JWT claim shape + fleet schema unchanged.

## [0.1.3] — 2026-04-17

### Fixed — sandboxed / no-workerd boot

- **`payload/resolveD1Binding`**: when `getCloudflareContext({ async: true })`
  throws (sandbox can't spawn workerd; `SKIP_CLOUDFLARE_DEV_INIT=true` set;
  host missing workerd binary), return a Proxy that impersonates
  `D1Database` but throws a clear error on any method call. Previously this
  threw at config-load time, which meant the Next server couldn't boot at
  all. Now the server boots, the public site serves, and only DB-touching
  requests error out (with actionable messaging).

- Downstream: `createPayloadConfig` no longer dies on module import in
  sandbox envs. Agents can edit frontend code with `pnpm dev` even where
  Miniflare can't initialize.

### Fleet impact: none.

## [0.1.2] — 2026-04-17

### Fixed

- **`analytics/CmsAnalytics.tsx`**: tsup now compiles JSX with the React 17+
  automatic runtime (`esbuildOptions.jsx = 'automatic'`). Previously the
  built `dist/analytics/index.js` required `React` to be in scope at the
  consumer — any Next import of `@ctwebsiteco/site-core/analytics` threw
  `ReferenceError: React is not defined`. Now imports `react/jsx-runtime`.

### Changed — dev-mode ergonomics

`site-core` now works with **zero env vars** for local dev + seeding. When
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `CLIENT_ID` are all unset:

- `supabase/middleware` `updateSession()` passes every request through
  without contacting Supabase (no auth, no redirect).
- `auth/supabaseStrategy` admits a synthetic super-admin user
  (`supabaseId=dev-local`, `email=dev@local`, `role=super_admin`). Shadow
  user row is upserted idempotently. `/admin` works end-to-end locally.
- `payload/createPayloadConfig` defaults `PAYLOAD_SECRET` to
  `dev-local-payload-secret-do-not-use-in-production` when the env is
  absent.

**Partial** env (e.g. `SUPABASE_URL` set but `CLIENT_ID` missing) is
treated as a misconfiguration and rejects auth — only "all set" or "all
missing" are valid states.

Production Workers always have the env populated via CI, so behavior there
is unchanged. The middleware also now fails open (passes request through)
if Supabase is unreachable at request time — a Supabase outage must not
lock editors out of `/admin`.

Fleet impact: none. JWT claim shape unchanged from 0.1.0.

## [0.1.0] — 2026-04-17

### Added

- Initial extraction from `template/`. No behavior change vs. the
  pre-extraction template build.
- `auth`: `supabaseStrategy`, `verifySupabaseJwt`, `findOrCreateShadowUser`,
  `resolveRole`, `parseCookieHeader`, types.
- `supabase`: server-side `createClient` reading Next.js cookies.
- `supabase/client`: browser `createClient` carrying `'use client'`.
- `supabase/middleware`: `updateSession` for session refresh + admin guard.
- `email`: `sendEmail` wrapper around Resend for non-form transactional mail.
- `analytics`: `CmsAnalytics` component (GA4 env-gated, RUM always-on).
- `payload`: `createPayloadConfig`, `createGetPayload`, `resolveD1Binding`.
- `collections`: `createUsersCollection` (shadow, auth-strategy attached,
  password-disabled), `createMediaCollection` (no sharp, R2-ready).
- `globals`: `siteSettingsGlobal`, `headerGlobal`, `footerGlobal`,
  `contactGlobal`.
- `types`: `CloudflareEnv` augmentation, `SupabaseClaims`, `ClientClaim`.

Fleet impact: JWT claim shape matches
`supabase/migrations/20260417120600_auth_hook.sql` at `a462013`.
