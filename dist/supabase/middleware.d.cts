import { NextRequest, NextResponse } from 'next/server';

type UpdateSessionOptions = {
    /** Path prefixes that require an authenticated Supabase session. */
    guardedPrefixes?: string[];
    /** Paths that must be allowed through even when unauthenticated. */
    authPaths?: string[];
    /** Where to redirect unauthenticated users. Defaults to /auth/login. */
    loginPath?: string;
};
declare function updateSession(request: NextRequest, options?: UpdateSessionOptions): Promise<NextResponse<unknown>>;

export { type UpdateSessionOptions, updateSession };
