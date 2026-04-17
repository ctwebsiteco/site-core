import type { GlobalConfig } from 'payload'

export const siteSettingsGlobal: GlobalConfig = {
  slug: 'site-settings',
  admin: { group: 'Settings' },
  access: { read: () => true },
  fields: [
    { name: 'brandName', type: 'text', required: true },
    { name: 'tagline', type: 'text' },
    {
      name: 'defaultSEO',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'image', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'socials',
      type: 'array',
      labels: { singular: 'Social link', plural: 'Social links' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          options: ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other'],
          required: true,
        },
        { name: 'url', type: 'text', required: true },
        { name: 'label', type: 'text' },
      ],
    },
  ],
}
