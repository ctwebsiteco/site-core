import path from 'path'
import {
  buildConfig,
  type CollectionConfig,
  type GlobalConfig,
  type Plugin,
  type Config,
  type SanitizedConfig,
} from 'payload'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { resendAdapter } from '@payloadcms/email-resend'

import { createUsersCollection } from '../collections/users'
import { createMediaCollection } from '../collections/media'
import { siteSettingsGlobal } from '../globals/siteSettings'
import { headerGlobal } from '../globals/header'
import { footerGlobal } from '../globals/footer'
import { contactGlobal } from '../globals/contact'

import { resolveD1Binding } from './resolveD1Binding'

export type CreatePayloadConfigOpts = {
  /**
   * Directory that owns payload-types.ts generation + importMap resolution.
   * Pass the consumer's `__dirname` (or the ESM equivalent).
   */
  rootDir: string
  /** Public site URL used for admin link generation. Falls back to env. */
  serverURL?: string
  /** Admin meta overrides. */
  admin?: {
    title?: string
    description?: string
  }
  /** Collections the consumer owns (Pages, Posts, custom). Core Users + Media are always present. */
  collections: CollectionConfig[]
  /** Globals beyond the 4 core globals (site-settings, header, footer, contact). */
  globals?: GlobalConfig[]
  /** Additional plugins. Appended after formBuilder. */
  plugins?: Plugin[]
  /** Form-builder field enables. Defaults to all basic types. */
  formFields?: Parameters<typeof formBuilderPlugin>[0]['fields']
  /**
   * Path to the generated payload-types.ts file.
   * Defaults to `<rootDir>/payload-types.ts`.
   */
  typesOutputFile?: string
}

const DEFAULT_FORM_FIELDS = {
  text: true,
  textarea: true,
  email: true,
  checkbox: true,
  select: true,
  number: true,
  message: true,
}

// Assembles a full Payload `Config` from the invariant plumbing plus
// consumer-specified overrides. Returns the result of `buildConfig()`,
// which consumers can `export default` from their own payload.config.ts.
//
// Returns `null` in two cases:
//   1. NODE_ENV !== 'production' (e.g. `next dev`). We deliberately skip
//      Payload init in dev so the consumer can render from fixtures via
//      createGetPayload(config, fixtures). Avoids the 10-second schema
//      sync on every dev start, native-dep complexity, and Miniflare
//      auto-init returning an empty D1 (which causes confusing 404s).
//   2. NODE_ENV is 'production' but resolveD1Binding throws (sandbox
//      without workerd). Same fixture-mock fallback applies.
//
// /admin won't render when this returns null — intentional. Use
// `pnpm preview` for the full Payload + D1 stack locally.

export async function createPayloadConfig(
  opts: CreatePayloadConfigOpts,
): Promise<SanitizedConfig | null> {
  const {
    rootDir,
    serverURL,
    admin,
    collections,
    globals = [],
    plugins = [],
    formFields = DEFAULT_FORM_FIELDS,
    typesOutputFile,
  } = opts

  // Dev mode short-circuit: skip Payload init entirely when not in
  // production. The frontend reads from fixtures via createGetPayload.
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  let binding
  try {
    binding = await resolveD1Binding()
  } catch (err) {
    console.warn(
      '[site-core] No Cloudflare D1 binding available — Payload disabled. ' +
      'Frontend will render via createMockPayload(fixtures).',
      (err as Error).message,
    )
    return null
  }

  const email =
    process.env.RESEND_API_KEY && process.env.RESEND_FROM
      ? resendAdapter({
          defaultFromAddress: process.env.RESEND_FROM,
          defaultFromName: process.env.RESEND_FROM_NAME || '',
          apiKey: process.env.RESEND_API_KEY,
        })
      : undefined

  const config: Config = {
    serverURL: serverURL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? '',
    admin: {
      user: 'users',
      importMap: { baseDir: rootDir },
      meta: {
        title: admin?.title ?? 'Admin — CT Website Co',
        description:
          admin?.description ??
          'Content admin for this site. Access is gated by Supabase Auth.',
      },
    },
    collections: [
      createUsersCollection(),
      createMediaCollection(),
      ...collections,
    ],
    globals: [
      siteSettingsGlobal,
      headerGlobal,
      footerGlobal,
      contactGlobal,
      ...globals,
    ],
    editor: lexicalEditor({}),
    // PAYLOAD_SECRET is required by Payload to encrypt admin tokens. In dev
    // (no env set), we generate a deterministic throwaway secret so the
    // template runs without a .env / .dev.vars file. In prod this MUST be
    // set via Worker secrets — CI enforces that the env is populated.
    secret:
      process.env.PAYLOAD_SECRET ||
      'dev-local-payload-secret-do-not-use-in-production',
    email,
    db: sqliteD1Adapter({
      binding,
      migrationDir: path.resolve(rootDir, '..', 'migrations'),
    }),
    typescript: {
      outputFile: typesOutputFile ?? path.resolve(rootDir, 'payload-types.ts'),
    },
    plugins: [
      formBuilderPlugin({
        fields: formFields,
        formOverrides: {
          admin: {
            group: 'Forms',
            description:
              'Configure fields and recipient emails. Editors can add/remove fields without touching code.',
          },
        },
        formSubmissionOverrides: {
          admin: {
            group: 'Forms',
            defaultColumns: ['form', 'createdAt'],
          },
        },
      }),
      ...plugins,
    ],
  }

  return buildConfig(config)
}
