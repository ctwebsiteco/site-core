import path from 'path';
import { buildConfig, getPayload } from 'payload';
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder';
import { resendAdapter } from '@payloadcms/email-resend';
import { createServerClient } from '@supabase/ssr';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// src/payload/createPayloadConfig.ts

// src/auth/cookieStore.ts
function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return [];
  return cookieHeader.split(";").map((pair) => pair.trim()).filter(Boolean).map((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return { name: pair, value: "" };
    const name = pair.slice(0, eqIdx).trim();
    const raw = pair.slice(eqIdx + 1).trim();
    let value;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    return { name, value };
  });
}
var cachedJwks;
var cachedJwksUrl;
function getJwks(jwksUrl) {
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl), {
      cooldownDuration: 3e4,
      cacheMaxAge: 10 * 6e4
    });
    cachedJwksUrl = jwksUrl;
  }
  return cachedJwks;
}
async function verifySupabaseJwt(token) {
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  if (!jwksUrl) {
    throw new Error("SUPABASE_JWKS_URL is not set");
  }
  try {
    const { payload } = await jwtVerify(token, getJwks(jwksUrl), {
      audience: "authenticated"
    });
    return payload;
  } catch {
    return null;
  }
}

// src/auth/shadowUser.ts
function resolveRole(claims, clientId) {
  if (claims.super_admin === true) return "super_admin";
  const match = claims.clients?.find((c) => c.id === clientId);
  return match?.role ?? "editor";
}
async function findOrCreateShadowUser(payload, input) {
  const existing = await payload.find({
    collection: "users",
    where: { supabaseId: { equals: input.supabaseId } },
    limit: 1,
    depth: 0
  });
  if (existing.docs.length > 0) {
    const current = existing.docs[0];
    const needsUpdate = current.email !== input.email || current.role !== input.role || input.name && current.name !== input.name;
    if (needsUpdate) {
      return payload.update({
        collection: "users",
        id: current.id,
        data: {
          email: input.email,
          role: input.role,
          ...input.name ? { name: input.name } : {}
        }
      });
    }
    return current;
  }
  return payload.create({
    collection: "users",
    data: {
      supabaseId: input.supabaseId,
      email: input.email,
      role: input.role,
      ...input.name ? { name: input.name } : {}
    }
  });
}

// src/auth/supabaseStrategy.ts
var supabaseStrategy = {
  name: "supabase",
  authenticate: async ({ headers, payload }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const clientId = process.env.CLIENT_ID;
    const noSupabase = !supabaseUrl && !supabaseAnonKey && !clientId;
    const partialSupabase = !noSupabase && (!supabaseUrl || !supabaseAnonKey || !clientId);
    if (partialSupabase) {
      return { user: null };
    }
    if (noSupabase) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      return {
        user: {
          id: 0,
          collection: "users",
          supabaseId: "dev-local",
          email: "dev@local",
          role: "super_admin",
          name: "Local Dev",
          createdAt: now,
          updatedAt: now
        }
      };
    }
    const cookies = parseCookieHeader(headers.get("cookie"));
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookies,
        // Auth strategy is read-only: we can't write Set-Cookie here.
        // Token refresh needs to happen via middleware on the request pipeline.
        setAll: () => {
        }
      }
    });
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { user: null };
    const claims = await verifySupabaseJwt(accessToken);
    if (!claims || !claims.sub) return { user: null };
    const admitted = claims.super_admin === true || Array.isArray(claims.clients) && claims.clients.some((c) => c.id === clientId);
    if (!admitted) return { user: null };
    const role = resolveRole(claims, clientId);
    const shadowUser = await findOrCreateShadowUser(payload, {
      supabaseId: claims.sub,
      email: claims.email ?? sessionData.session.user.email ?? "",
      role
    });
    return {
      user: {
        ...shadowUser,
        collection: "users"
      }
    };
  }
};

// src/collections/users.ts
function createUsersCollection(opts = {}) {
  const { extraFields = [] } = opts;
  return {
    slug: "users",
    admin: {
      useAsTitle: "email",
      defaultColumns: ["email", "role", "updatedAt"]
    },
    auth: {
      disableLocalStrategy: true,
      strategies: [supabaseStrategy]
    },
    access: {
      read: ({ req }) => Boolean(req.user),
      create: ({ req }) => req.user?.role === "super_admin" || req.user?.role === "owner",
      update: ({ req }) => Boolean(req.user),
      delete: ({ req }) => req.user?.role === "super_admin"
    },
    fields: [
      {
        name: "supabaseId",
        type: "text",
        required: true,
        unique: true,
        index: true,
        admin: { readOnly: true, description: "auth.users.id in Supabase." }
      },
      {
        name: "email",
        type: "email",
        required: true,
        admin: { readOnly: true, description: "Mirrored from Supabase on every login." }
      },
      {
        name: "role",
        type: "select",
        required: true,
        options: [
          { label: "Super admin (agency)", value: "super_admin" },
          { label: "Owner", value: "owner" },
          { label: "Editor", value: "editor" }
        ],
        defaultValue: "editor",
        admin: { readOnly: true, description: "Resolved from JWT claims on every login." }
      },
      {
        name: "name",
        type: "text"
      },
      ...extraFields
    ]
  };
}

// src/collections/media.ts
function createMediaCollection(opts = {}) {
  const { extraFields = [] } = opts;
  return {
    slug: "media",
    upload: {
      // Image processing (sharp) is not supported on Workers. Serve originals.
      // If a client ever needs resizing, layer Cloudflare Images in front — see
      // docs/DEPLOYMENT.md and ADR-008 for rationale.
      imageSizes: [],
      adminThumbnail: void 0,
      mimeTypes: ["image/*", "application/pdf", "video/mp4"]
    },
    access: {
      read: () => true,
      create: ({ req }) => Boolean(req.user),
      update: ({ req }) => Boolean(req.user),
      delete: ({ req }) => Boolean(req.user)
    },
    fields: [
      { name: "alt", type: "text", required: true },
      { name: "caption", type: "text" },
      ...extraFields
    ]
  };
}

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
async function resolveD1Binding() {
  const ctx = await getCloudflareContext({ async: true });
  const env = ctx.env;
  if (!env.DB) {
    throw new Error(
      'D1 binding "DB" not bound on Cloudflare context \u2014 check wrangler.toml.'
    );
  }
  return env.DB;
}

// src/payload/createPayloadConfig.ts
var DEFAULT_FORM_FIELDS = {
  text: true,
  textarea: true,
  email: true,
  checkbox: true,
  select: true,
  number: true,
  message: true
};
async function createPayloadConfig(opts) {
  const {
    rootDir,
    serverURL,
    admin,
    collections,
    globals = [],
    plugins = [],
    formFields = DEFAULT_FORM_FIELDS,
    typesOutputFile
  } = opts;
  if (process.env.NODE_ENV !== "production") {
    return null;
  }
  let binding;
  try {
    binding = await resolveD1Binding();
  } catch (err) {
    console.warn(
      "[site-core] No Cloudflare D1 binding available \u2014 Payload disabled. Frontend will render via createMockPayload(fixtures).",
      err.message
    );
    return null;
  }
  const email = process.env.RESEND_API_KEY && process.env.RESEND_FROM ? resendAdapter({
    defaultFromAddress: process.env.RESEND_FROM,
    defaultFromName: process.env.RESEND_FROM_NAME || "",
    apiKey: process.env.RESEND_API_KEY
  }) : void 0;
  const config = {
    serverURL: serverURL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? "",
    admin: {
      user: "users",
      importMap: { baseDir: rootDir },
      meta: {
        title: admin?.title ?? "Admin \u2014 CT Website Co",
        description: admin?.description ?? "Content admin for this site. Access is gated by Supabase Auth."
      }
    },
    collections: [
      createUsersCollection(),
      createMediaCollection(),
      ...collections
    ],
    globals: [
      siteSettingsGlobal,
      headerGlobal,
      footerGlobal,
      contactGlobal,
      ...globals
    ],
    editor: lexicalEditor({}),
    // PAYLOAD_SECRET is required by Payload to encrypt admin tokens. In dev
    // (no env set), we generate a deterministic throwaway secret so the
    // template runs without a .env / .dev.vars file. In prod this MUST be
    // set via Worker secrets — CI enforces that the env is populated.
    secret: process.env.PAYLOAD_SECRET || "dev-local-payload-secret-do-not-use-in-production",
    email,
    db: sqliteD1Adapter({
      binding,
      migrationDir: path.resolve(rootDir, "..", "migrations")
    }),
    typescript: {
      outputFile: typesOutputFile ?? path.resolve(rootDir, "payload-types.ts")
    },
    plugins: [
      formBuilderPlugin({
        fields: formFields,
        formOverrides: {
          admin: {
            group: "Forms",
            description: "Configure fields and recipient emails. Editors can add/remove fields without touching code."
          }
        },
        formSubmissionOverrides: {
          admin: {
            group: "Forms",
            defaultColumns: ["form", "createdAt"]
          }
        }
      }),
      ...plugins
    ]
  };
  return buildConfig(config);
}

// src/payload/mockPayload.ts
function matches(doc, where) {
  if (!where) return true;
  for (const [field, condition] of Object.entries(where)) {
    const value = doc[field];
    if (condition.equals !== void 0 && value !== condition.equals) return false;
    if (condition.in !== void 0 && !condition.in.includes(value)) return false;
  }
  return true;
}
function unsupported(method) {
  throw new Error(
    `[site-core] mockPayload.${method}() is not implemented in dev fixture mode. Run \`pnpm preview\` (wrangler) for real Payload + D1 if you need this method locally.`
  );
}
function createMockPayload(fixtures) {
  const collections = fixtures.collections ?? {};
  const globals = fixtures.globals ?? {};
  return {
    async find({
      collection,
      where,
      limit = 10,
      page = 1,
      depth: _depth = 0
    }) {
      const all = collections[collection] ?? [];
      const matched = all.filter((d) => matches(d, where));
      const start = (page - 1) * limit;
      const docs = matched.slice(start, start + limit);
      const totalDocs = matched.length;
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
      return {
        docs,
        totalDocs,
        limit,
        page,
        totalPages,
        pagingCounter: start + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null
      };
    },
    async findByID({ collection, id }) {
      const all = collections[collection] ?? [];
      return all.find((d) => d.id === id) ?? null;
    },
    async findGlobal({ slug, depth: _depth = 0 }) {
      return globals[slug] ?? null;
    },
    // Surface methods that may be called but aren't implemented — clearly
    // signal "not supported in dev fixture mode" instead of silently
    // returning undefined.
    create: () => unsupported("create"),
    update: () => unsupported("update"),
    delete: () => unsupported("delete"),
    updateGlobal: () => unsupported("updateGlobal"),
    sendEmail: async () => {
      console.warn("[site-core] mockPayload.sendEmail noop in dev fixture mode");
    }
  };
}

// src/payload/createGetPayload.ts
function createGetPayload(config, fixtures) {
  let cached;
  return async () => {
    if (cached) return cached;
    const resolved = await config;
    if (resolved === null) {
      if (!fixtures) {
        throw new Error(
          "[site-core] createGetPayload called with null config and no fixtures. Either provide fixtures (dev) or run with a real Cloudflare context (prod / pnpm preview)."
        );
      }
      cached = createMockPayload(fixtures);
      return cached;
    }
    cached = await getPayload({ config: resolved });
    return cached;
  };
}

export { createGetPayload, createMockPayload, createPayloadConfig, resolveD1Binding };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map