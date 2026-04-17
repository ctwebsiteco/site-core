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
declare function createPayloadConfig(opts: CreatePayloadConfigOpts): Promise<SanitizedConfig>;

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>;
declare function createGetPayload(config: SanitizedConfig | Promise<SanitizedConfig>): () => Promise<PayloadInstance>;

declare function resolveD1Binding(): Promise<D1Database>;

export { type CreatePayloadConfigOpts, createGetPayload, createPayloadConfig, resolveD1Binding };
