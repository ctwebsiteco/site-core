import { Payload } from 'payload';
import { JWTPayload } from 'jose';

type ClientClaim = {
    id: string;
    slug: string;
    role: 'owner' | 'editor';
};
type SupabaseClaims = JWTPayload & {
    email?: string;
    super_admin?: boolean;
    clients?: ClientClaim[];
};
declare function verifySupabaseJwt(token: string): Promise<SupabaseClaims | null>;

type ShadowRole = 'super_admin' | 'owner' | 'editor';
declare function resolveRole(claims: SupabaseClaims, clientId: string): ShadowRole;
type ShadowUserInput = {
    supabaseId: string;
    email: string;
    role: ShadowRole;
    name?: string;
};
declare function findOrCreateShadowUser(payload: Payload, input: ShadowUserInput): Promise<any>;

export { type ClientClaim as C, type ShadowRole as S, type SupabaseClaims as a, findOrCreateShadowUser as f, resolveRole as r, verifySupabaseJwt as v };
