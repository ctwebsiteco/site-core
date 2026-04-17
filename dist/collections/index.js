import { createServerClient } from '@supabase/ssr';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// src/auth/supabaseStrategy.ts

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

export { createMediaCollection, createUsersCollection };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map