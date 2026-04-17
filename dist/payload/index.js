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

// src/payload/localD1.ts
function emptyMeta() {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
    served_by: "local",
    served_by_region: "",
    served_by_primary_region: "",
    timings: { sql_duration_ms: 0 }
  };
}
var LocalD1PreparedStatement = class _LocalD1PreparedStatement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  db;
  sql;
  params;
  bind(...values) {
    const normalized = values.map(
      (v) => typeof v === "bigint" ? v : v === void 0 ? null : v
    );
    return new _LocalD1PreparedStatement(this.db, this.sql, normalized);
  }
  async first(colName) {
    const stmt = this.db.prepare(this.sql);
    if (!stmt.reader) {
      stmt.run(...this.params);
      return null;
    }
    const row = stmt.get(...this.params);
    if (!row) return null;
    if (colName) return row[colName] ?? null;
    return row;
  }
  async run() {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.params);
    const meta = emptyMeta();
    meta.changes = info.changes;
    meta.rows_written = info.changes;
    meta.last_row_id = typeof info.lastInsertRowid === "bigint" ? Number(info.lastInsertRowid) : info.lastInsertRowid;
    meta.changed_db = info.changes > 0;
    return { success: true, meta, results: [] };
  }
  async all() {
    const stmt = this.db.prepare(this.sql);
    if (!stmt.reader) {
      const info = stmt.run(...this.params);
      const meta2 = emptyMeta();
      meta2.changes = info.changes;
      meta2.rows_written = info.changes;
      meta2.last_row_id = typeof info.lastInsertRowid === "bigint" ? Number(info.lastInsertRowid) : info.lastInsertRowid;
      meta2.changed_db = info.changes > 0;
      return { success: true, meta: meta2, results: [] };
    }
    const rows = stmt.all(...this.params);
    const meta = emptyMeta();
    meta.rows_read = rows.length;
    return { success: true, meta, results: rows };
  }
  async raw(options) {
    const stmt = this.db.prepare(this.sql);
    if (!stmt.reader) {
      stmt.run(...this.params);
      return [];
    }
    const rawStmt = stmt.raw(true);
    const rows = rawStmt.all(...this.params);
    if (options?.columnNames) {
      const cols = rawStmt.columns().map((c) => c.name);
      return [cols, ...rows];
    }
    return rows;
  }
};
var LocalD1Database = class {
  constructor(db) {
    this.db = db;
  }
  db;
  prepare(sql) {
    return new LocalD1PreparedStatement(this.db, sql);
  }
  async batch(statements) {
    const runAll = this.db.transaction(() => {
      const results = [];
      for (const s of statements) {
        const inner = s;
        const stmt = this.db.prepare(inner.sql);
        const params = inner.params;
        const info = stmt.run(...params);
        const meta = emptyMeta();
        meta.changes = info.changes;
        meta.rows_written = info.changes;
        meta.last_row_id = typeof info.lastInsertRowid === "bigint" ? Number(info.lastInsertRowid) : info.lastInsertRowid;
        results.push({ success: true, meta, results: [] });
      }
      return results;
    });
    return runAll();
  }
  async exec(query) {
    const start = performance.now();
    const statements = query.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
    for (const stmt of statements) {
      this.db.exec(stmt + ";");
    }
    return {
      count: statements.length,
      duration: performance.now() - start
    };
  }
  async dump() {
    throw new Error(
      "[site-core] LocalD1Database.dump() is not implemented \u2014 use wrangler against the real D1 for production dumps."
    );
  }
  withSession() {
    throw new Error(
      "[site-core] LocalD1Database.withSession() is not implemented \u2014 no session replication in local dev."
    );
  }
};
async function createLocalD1(filePath) {
  let Database;
  try {
    const mod = await import('better-sqlite3');
    Database = mod.default ?? mod;
  } catch (err) {
    throw new Error(
      `[site-core] Local SQLite fallback requires \`better-sqlite3\` as a dependency. Install it in the consumer: \`bun add -d better-sqlite3\` (or pnpm / npm). Original error: ${err.message}`
    );
  }
  const { mkdirSync } = await import('fs');
  const path2 = await import('path');
  mkdirSync(path2.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return new LocalD1Database(db);
}

// src/payload/resolveD1Binding.ts
async function resolveD1Binding() {
  if (process.env.FORCE_LOCAL_D1 === "true" || process.env.FORCE_LOCAL_D1 === "1") {
    console.warn(
      "[site-core] FORCE_LOCAL_D1 set \u2014 using local SQLite at LOCAL_D1_PATH or .payload/local.db."
    );
    return createLocalD1(process.env.LOCAL_D1_PATH ?? ".payload/local.db");
  }
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env;
    if (env.DB) {
      return env.DB;
    }
    console.warn(
      "[site-core] Cloudflare context resolved but env.DB is unbound \u2014 falling back to local SQLite."
    );
  } catch (err) {
    console.warn(
      "[site-core] getCloudflareContext() threw \u2014 falling back to local SQLite at LOCAL_D1_PATH or .payload/local.db.",
      err.message
    );
  }
  const localPath = process.env.LOCAL_D1_PATH ?? ".payload/local.db";
  return createLocalD1(localPath);
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
  const binding = await resolveD1Binding();
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
function createGetPayload(config) {
  let cached;
  return async () => {
    if (!cached) {
      cached = await getPayload({ config: await config });
    }
    return cached;
  };
}

export { createGetPayload, createPayloadConfig, resolveD1Binding };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map