import type { CollectionConfig } from 'payload'

export type CreateMediaCollectionOpts = {
  /** Extra fields beyond alt + caption. */
  extraFields?: CollectionConfig['fields']
}

export function createMediaCollection(
  opts: CreateMediaCollectionOpts = {},
): CollectionConfig {
  const { extraFields = [] } = opts

  return {
    slug: 'media',
    upload: {
      // Image processing (sharp) is not supported on Workers. Serve originals.
      // If a client ever needs resizing, layer Cloudflare Images in front — see
      // docs/DEPLOYMENT.md and ADR-008 for rationale.
      imageSizes: [],
      adminThumbnail: undefined,
      mimeTypes: ['image/*', 'application/pdf', 'video/mp4'],
    },
    access: {
      read: () => true,
      create: ({ req }) => Boolean(req.user),
      update: ({ req }) => Boolean(req.user),
      delete: ({ req }) => Boolean(req.user),
    },
    fields: [
      { name: 'alt', type: 'text', required: true },
      { name: 'caption', type: 'text' },
      ...extraFields,
    ],
  }
}
