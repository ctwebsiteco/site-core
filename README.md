# @ctwebsiteco/site-core

Invariant plumbing shared by every CT Website Co per-client site.

**Scope:** auth, Supabase session wiring, Resend email, analytics, Payload
factory, core Users/Media collections, core globals, shared types.

**Not in scope:** anything the AI orchestrator customizes per client —
block renderers, header/footer visuals, bespoke pages, Pages collection
block list.

## Why

Fleet-wide patchability. A security fix in JWT verification becomes
`pnpm up @ctwebsiteco/site-core@X.Y.Z` across all 250 client repos
instead of 250 manual template merges.

## Installation

Private package on GitHub Packages. Consumers need `.npmrc`:

```
@ctwebsiteco:registry=https://npm.pkg.github.com
auto-install-peers=true
```

Locally, set `NODE_AUTH_TOKEN` to a GitHub PAT with `read:packages`.
In CI, `secrets.GITHUB_TOKEN` works.

```bash
pnpm add @ctwebsiteco/site-core
```

## Exports (subpath)

| Entry | Purpose |
|---|---|
| `@ctwebsiteco/site-core/auth` | `supabaseStrategy`, `verifySupabaseJwt`, `findOrCreateShadowUser`, `resolveRole`, `parseCookieHeader`, types |
| `@ctwebsiteco/site-core/supabase` | `createClient` (server-side, reads `next/headers`) |
| `@ctwebsiteco/site-core/supabase/client` | `createClient` (browser, ships `'use client'`) |
| `@ctwebsiteco/site-core/supabase/middleware` | `updateSession` helper |
| `@ctwebsiteco/site-core/email` | `sendEmail` wrapper for non-form transactional mail |
| `@ctwebsiteco/site-core/analytics` | `CmsAnalytics` (GA4 env-gated + RUM always-on) |
| `@ctwebsiteco/site-core/payload` | `createPayloadConfig`, `createGetPayload`, `resolveD1Binding` |
| `@ctwebsiteco/site-core/collections` | `createUsersCollection`, `createMediaCollection` |
| `@ctwebsiteco/site-core/globals` | `siteSettingsGlobal`, `headerGlobal`, `footerGlobal`, `contactGlobal` |
| `@ctwebsiteco/site-core/types` | `CloudflareEnv` augmentation, `SupabaseClaims`, `ClientClaim` |

## Version policy

SemVer, but scope is deliberately narrow:

- **Patch**: bug fixes, no API changes.
- **Minor**: additive API changes, no JWT claim shape changes.
- **Major**: JWT claim shape changes, breaking API removals. Requires a
  paired Supabase migration — flag in `CHANGELOG.md` with `Fleet impact:`.

## Releasing

See [CHANGELOG.md](./CHANGELOG.md) for the version history.

Procedure:

1. Bump `package.json` version
2. Append to `CHANGELOG.md`
3. `git commit && git tag site-core-v<version>`
4. `git push && git push --tags`
5. `.github/workflows/publish-site-core.yml` builds and publishes

Consumers:

```bash
pnpm up @ctwebsiteco/site-core@<version>
```
