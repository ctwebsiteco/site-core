'use strict';

// src/globals/siteSettings.ts
var siteSettingsGlobal = {
  slug: "site-settings",
  admin: { group: "Settings" },
  access: { read: () => true },
  fields: [
    { name: "brandName", type: "text", required: true },
    { name: "tagline", type: "text" },
    {
      name: "defaultSEO",
      type: "group",
      fields: [
        { name: "title", type: "text" },
        { name: "description", type: "textarea" },
        { name: "image", type: "upload", relationTo: "media" }
      ]
    },
    {
      name: "socials",
      type: "array",
      labels: { singular: "Social link", plural: "Social links" },
      fields: [
        {
          name: "platform",
          type: "select",
          options: ["twitter", "facebook", "instagram", "linkedin", "youtube", "tiktok", "other"],
          required: true
        },
        { name: "url", type: "text", required: true },
        { name: "label", type: "text" }
      ]
    }
  ]
};

// src/globals/header.ts
var headerGlobal = {
  slug: "header",
  admin: { group: "Navigation" },
  access: { read: () => true },
  fields: [
    { name: "logo", type: "upload", relationTo: "media" },
    {
      name: "navItems",
      type: "array",
      labels: { singular: "Nav item", plural: "Nav items" },
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
        {
          name: "openInNewTab",
          type: "checkbox",
          defaultValue: false
        }
      ]
    },
    {
      name: "ctaButton",
      type: "group",
      fields: [
        { name: "label", type: "text" },
        { name: "url", type: "text" }
      ]
    }
  ]
};

// src/globals/footer.ts
var footerGlobal = {
  slug: "footer",
  admin: { group: "Navigation" },
  access: { read: () => true },
  fields: [
    {
      name: "columns",
      type: "array",
      labels: { singular: "Column", plural: "Columns" },
      fields: [
        { name: "heading", type: "text", required: true },
        {
          name: "links",
          type: "array",
          fields: [
            { name: "label", type: "text", required: true },
            { name: "url", type: "text", required: true }
          ]
        }
      ]
    },
    { name: "copyright", type: "text" }
  ]
};

// src/globals/contact.ts
var contactGlobal = {
  slug: "contact",
  admin: { group: "Settings" },
  access: { read: () => true },
  fields: [
    { name: "address", type: "textarea" },
    { name: "phone", type: "text" },
    { name: "email", type: "email" },
    { name: "mapLink", type: "text", label: "Map link (Google Maps or similar)" },
    {
      name: "hours",
      type: "array",
      labels: { singular: "Hours row", plural: "Hours rows" },
      fields: [
        { name: "label", type: "text", required: true, admin: { description: 'e.g. "Mon\u2013Fri"' } },
        { name: "value", type: "text", required: true, admin: { description: 'e.g. "9am\u20135pm"' } }
      ]
    }
  ]
};

exports.contactGlobal = contactGlobal;
exports.footerGlobal = footerGlobal;
exports.headerGlobal = headerGlobal;
exports.siteSettingsGlobal = siteSettingsGlobal;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map