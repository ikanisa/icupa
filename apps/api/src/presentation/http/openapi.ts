import { zodToJsonSchema } from 'zod-to-json-schema';
import { writeFile } from 'fs/promises';
import { env } from '../../config/env.js';
import {
  userSchema,
  tenantSchema,
  listingSchema,
  orderSchema,
  bookingSchema,
  paymentSchema
} from '@icupa/domain';

const schemas = {
  User: userSchema,
  Tenant: tenantSchema,
  Listing: listingSchema,
  Order: orderSchema,
  Booking: bookingSchema,
  Payment: paymentSchema
};

export const generateOpenApi = async () => {
  const components = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, zodToJsonSchema(schema, name)])
  );

  const document = {
    openapi: '3.1.0',
    info: {
      title: 'ICUPA API',
      version: '1.0.0'
    },
    paths: {
      '/v1/users': {
        get: { responses: { '200': { description: 'List users' } } },
        post: { responses: { '201': { description: 'Create user' } } }
      }
    },
    components: {
      schemas: components
    }
  };

  await writeFile(env.OPENAPI_OUTPUT_PATH, JSON.stringify(document, null, 2));
  return document;
};
