import { userSchema, listingSchema } from '@icupa/domain';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { moduleRegistry } from '../../modules/index.js';

const toFields = (schema: ReturnType<typeof zodToJsonSchema>) =>
  Object.entries((schema as any).properties ?? {})
    .map(([key, value]) => `  ${key}: ${mapType(value as Record<string, any>)}`)
    .join('\n');

const mapType = (property: Record<string, any>) => {
  const type = property.type ?? 'String';
  switch (type) {
    case 'string':
      return 'String';
    case 'number':
      return 'Float';
    case 'integer':
      return 'Int';
    case 'boolean':
      return 'Boolean';
    default:
      return 'String';
  }
};

export const graphqlSchemaSDL = `type User {\n${toFields(zodToJsonSchema(userSchema))}\n}\n\ntype Listing {\n${toFields(
  zodToJsonSchema(listingSchema)
)}\n}\n\ntype Query {\n  users: [User!]!\n  listings: [Listing!]!\n}`;

export const executeGraphqlQuery = async (query: string, actorId = 'graphql') => {
  const data: Record<string, unknown> = {};
  if (query.includes('users')) {
    data.users = await moduleRegistry.users.list({ actorId, correlationId: 'graphql' });
  }
  if (query.includes('listings')) {
    data.listings = await moduleRegistry.listings.list({ actorId, correlationId: 'graphql' });
  }
  return { data };
};
