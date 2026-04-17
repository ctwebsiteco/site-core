export { C as ClientClaim, S as ShadowRole, a as SupabaseClaims, f as findOrCreateShadowUser, r as resolveRole, v as verifySupabaseJwt } from '../shadowUser-CCqJQSVZ.cjs';
import { AuthStrategy } from 'payload';
import 'jose';

type ParsedCookie = {
    name: string;
    value: string;
};
declare function parseCookieHeader(cookieHeader: string | null | undefined): ParsedCookie[];

declare const supabaseStrategy: AuthStrategy;

export { type ParsedCookie, parseCookieHeader, supabaseStrategy };
