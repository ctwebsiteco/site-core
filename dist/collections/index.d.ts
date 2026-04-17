import { CollectionConfig } from 'payload';

type CreateUsersCollectionOpts = {
    /** Extra fields to append to the core shadow fields. */
    extraFields?: CollectionConfig['fields'];
};
declare function createUsersCollection(opts?: CreateUsersCollectionOpts): CollectionConfig;

type CreateMediaCollectionOpts = {
    /** Extra fields beyond alt + caption. */
    extraFields?: CollectionConfig['fields'];
};
declare function createMediaCollection(opts?: CreateMediaCollectionOpts): CollectionConfig;

export { type CreateMediaCollectionOpts, type CreateUsersCollectionOpts, createMediaCollection, createUsersCollection };
