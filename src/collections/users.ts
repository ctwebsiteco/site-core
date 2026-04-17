import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '../auth/supabaseStrategy'

// Shadow user collection. Payload's local password strategy is DISABLED —
// Supabase Auth is the source of truth for identity. These rows exist only so
// Payload has a user reference to attach to content (authorship, audit, etc.).

export type CreateUsersCollectionOpts = {
  /** Extra fields to append to the core shadow fields. */
  extraFields?: CollectionConfig['fields']
}

export function createUsersCollection(
  opts: CreateUsersCollectionOpts = {},
): CollectionConfig {
  const { extraFields = [] } = opts

  return {
    slug: 'users',
    admin: {
      useAsTitle: 'email',
      defaultColumns: ['email', 'role', 'updatedAt'],
    },
    auth: {
      disableLocalStrategy: true,
      strategies: [supabaseStrategy],
    },
    access: {
      read: ({ req }) => Boolean(req.user),
      create: ({ req }) =>
        req.user?.role === 'super_admin' || req.user?.role === 'owner',
      update: ({ req }) => Boolean(req.user),
      delete: ({ req }) => req.user?.role === 'super_admin',
    },
    fields: [
      {
        name: 'supabaseId',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        admin: { readOnly: true, description: 'auth.users.id in Supabase.' },
      },
      {
        name: 'email',
        type: 'email',
        required: true,
        admin: { readOnly: true, description: 'Mirrored from Supabase on every login.' },
      },
      {
        name: 'role',
        type: 'select',
        required: true,
        options: [
          { label: 'Super admin (agency)', value: 'super_admin' },
          { label: 'Owner', value: 'owner' },
          { label: 'Editor', value: 'editor' },
        ],
        defaultValue: 'editor',
        admin: { readOnly: true, description: 'Resolved from JWT claims on every login.' },
      },
      {
        name: 'name',
        type: 'text',
      },
      ...extraFields,
    ],
  }
}
