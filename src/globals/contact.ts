import type { GlobalConfig } from 'payload'

export const contactGlobal: GlobalConfig = {
  slug: 'contact',
  admin: { group: 'Settings' },
  access: { read: () => true },
  fields: [
    { name: 'address', type: 'textarea' },
    { name: 'phone', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'mapLink', type: 'text', label: 'Map link (Google Maps or similar)' },
    {
      name: 'hours',
      type: 'array',
      labels: { singular: 'Hours row', plural: 'Hours rows' },
      fields: [
        { name: 'label', type: 'text', required: true, admin: { description: 'e.g. "Mon–Fri"' } },
        { name: 'value', type: 'text', required: true, admin: { description: 'e.g. "9am–5pm"' } },
      ],
    },
  ],
}
