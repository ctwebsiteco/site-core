# Changelog

All notable changes to `@ctwebsiteco/site-core` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning: [Semantic Versioning](https://semver.org/).

Each entry may include a `Fleet impact:` line when the change affects
runtime behavior that depends on the shared Supabase fleet schema —
consumers must coordinate a migration or a particular JWT hook version.

## [Unreleased]

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
