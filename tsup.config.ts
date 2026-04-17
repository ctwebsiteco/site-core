import { defineConfig } from 'tsup'

const EXTERNAL = [
  // Peer deps — consumer owns versions
  'next',
  'next/*',
  'react',
  'react-dom',
  'payload',
  '@payloadcms/db-d1-sqlite',
  '@payloadcms/richtext-lexical',
  '@payloadcms/plugin-form-builder',
  '@payloadcms/email-resend',
  '@opennextjs/cloudflare',
  '@cloudflare/workers-types',
  // Own direct deps stay external too — listed explicitly for clarity.
  'jose',
  '@supabase/ssr',
  '@supabase/supabase-js',
  'resend',
  'clsx',
  'tailwind-merge',
]

// Single config. `scripts/add-use-client.mjs` runs after tsup and
// prepends `'use client';` to dist/supabase/client.{js,cjs} — esbuild's
// directive preservation is inconsistent when mixed with bundled
// externals, so the postbuild script is the reliable option.

export default defineConfig({
  entry: {
    'auth/index': 'src/auth/index.ts',
    'supabase/index': 'src/supabase/index.ts',
    'supabase/client': 'src/supabase/client.ts',
    'supabase/middleware': 'src/supabase/middleware.ts',
    'email/index': 'src/email/index.ts',
    'analytics/index': 'src/analytics/index.ts',
    'payload/index': 'src/payload/index.ts',
    'collections/index': 'src/collections/index.ts',
    'globals/index': 'src/globals/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  target: 'es2022',
  external: EXTERNAL,
  splitting: false,
  clean: true,
  // Use React 17+ automatic JSX runtime so CmsAnalytics (and any future
  // .tsx in this package) compiles without requiring `React` in scope at
  // the consumer. Needed because tsconfig sets `jsx: preserve`, which
  // leaves JSX un-transformed unless esbuild is told to compile it here.
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
