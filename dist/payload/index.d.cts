import { CollectionConfig, GlobalConfig, Plugin, SanitizedConfig, getPayload } from 'payload';
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder';
import { D1Database } from '@cloudflare/workers-types';

type CreatePayloadConfigOpts = {
    /**
     * Directory that owns payload-types.ts generation + importMap resolution.
     * Pass the consumer's `__dirname` (or the ESM equivalent).
     */
    rootDir: string;
    /** Public site URL used for admin link generation. Falls back to env. */
    serverURL?: string;
    /** Admin meta overrides. */
    admin?: {
        title?: string;
        description?: string;
    };
    /** Collections the consumer owns (Pages, Posts, custom). Core Users + Media are always present. */
    collections: CollectionConfig[];
    /** Globals beyond the 4 core globals (site-settings, header, footer, contact). */
    globals?: GlobalConfig[];
    /** Additional plugins. Appended after formBuilder. */
    plugins?: Plugin[];
    /** Form-builder field enables. Defaults to all basic types. */
    formFields?: Parameters<typeof formBuilderPlugin>[0]['fields'];
    /**
     * Path to the generated payload-types.ts file.
     * Defaults to `<rootDir>/payload-types.ts`.
     */
    typesOutputFile?: string;
};
declare function createPayloadConfig(opts: CreatePayloadConfigOpts): Promise<SanitizedConfig | null>;

type MockFixtures = {
    /** Map of collection slug → array of docs. */
    collections?: Record<string, Array<Record<string, any>>>;
    /** Map of global slug → doc. */
    globals?: Record<string, Record<string, any>>;
};
type WhereClause = Record<string, {
    equals?: unknown;
    in?: unknown[];
}>;
declare function createMockPayload(fixtures: MockFixtures): {
    find({ collection, where, limit, page, depth: _depth, }: {
        collection: string;
        where?: WhereClause;
        limit?: number;
        page?: number;
        depth?: number;
    }): Promise<{
        docs: Record<string, any>[];
        totalDocs: number;
        limit: number;
        page: number;
        totalPages: number;
        pagingCounter: number;
        hasPrevPage: boolean;
        hasNextPage: boolean;
        prevPage: number | null;
        nextPage: number | null;
    }>;
    findByID({ collection, id }: {
        collection: string;
        id: string | number;
    }): Promise<Record<string, any> | null>;
    findGlobal({ slug, depth: _depth }: {
        slug: string;
        depth?: number;
    }): Promise<Record<string, any>>;
    create: () => never;
    update: () => never;
    delete: () => never;
    updateGlobal: () => never;
    sendEmail: () => Promise<void>;
};
type MockPayload = ReturnType<typeof createMockPayload>;

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>;
type CreateGetPayloadResult = () => Promise<PayloadInstance | MockPayload>;
declare function createGetPayload(config: SanitizedConfig | null | Promise<SanitizedConfig | null>, fixtures?: MockFixtures): CreateGetPayloadResult;

declare function resolveD1Binding(): Promise<D1Database>;

export { type CreatePayloadConfigOpts, type MockFixtures, type MockPayload, createGetPayload, createMockPayload, createPayloadConfig, resolveD1Binding };
