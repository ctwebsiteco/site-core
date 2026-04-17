import { D1Database, R2Bucket } from '@cloudflare/workers-types';
export { C as ClientClaim, S as ShadowRole, a as SupabaseClaims } from '../shadowUser-CCqJQSVZ.cjs';
import 'payload';
import 'jose';

declare global {
    interface CloudflareEnv {
        DB: D1Database;
        MEDIA: R2Bucket;
    }
}
