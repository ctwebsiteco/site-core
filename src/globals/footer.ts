import type { GlobalConfig } from 'payload'

export const footerGlobal: GlobalConfig = {
  slug: 'footer',
  admin: { group: 'Navigation' },
  access: { read: () => true },
  fields: [
    {
      name: 'columns',
      type: 'array',
      labels: { singular: 'Column', plural: 'Columns' },
      fields: [
        { name: 'heading', type: 'text', required: true },
        {
          name: 'links',
          type: 'array',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'url', type: 'text', required: true },
          ],
        },
      ],
    },
    { name: 'copyright', type: 'text' },
  ],
}
