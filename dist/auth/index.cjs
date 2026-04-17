'use strict';

var jose = require('jose');
var ssr = require('@supabase/ssr');

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
    cachedJwks = jose.createRemoteJWKSet(new URL(jwksUrl), {
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
    const { payload } = await jose.jwtVerify(token, getJwks(jwksUrl), {
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
    const supabase = ssr.createServerClient(supabaseUrl, supabaseAnonKey, {
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

exports.findOrCreateShadowUser = findOrCreateShadowUser;
exports.parseCookieHeader = parseCookieHeader;
exports.resolveRole = resolveRole;
exports.supabaseStrategy = supabaseStrategy;
exports.verifySupabaseJwt = verifySupabaseJwt;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map