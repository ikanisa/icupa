import { z } from 'zod';

const id = z.string().min(1);
const timestamp = z.date();

export const tenantSchema = z.object({
  id,
  name: z.string().min(2),
  slug: z.string().min(2),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const userSchema = z.object({
  id,
  email: z.string().email(),
  displayName: z.string().min(2),
  tenantId: id.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const listingSchema = z.object({
  id,
  tenantId: id,
  title: z.string().min(3),
  description: z.string().min(10),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const inventoryItemSchema = z.object({
  id,
  listingId: id,
  quantity: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const orderSchema = z.object({
  id,
  userId: id,
  tenantId: id,
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.enum(['pending', 'paid', 'cancelled']),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const bookingSchema = z.object({
  id,
  listingId: id,
  userId: id,
  startDate: timestamp,
  endDate: timestamp,
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const paymentSchema = z.object({
  id,
  orderId: id,
  provider: z.string(),
  reference: z.string(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.enum(['initiated', 'succeeded', 'failed']),
  createdAt: timestamp
});

export const searchDocumentSchema = z.object({
  id,
  index: z.string().min(2),
  payload: z.record(z.any()),
  createdAt: timestamp
});

export const messageSchema = z.object({
  id,
  tenantId: id,
  sender: z.string(),
  recipient: z.string(),
  body: z.string(),
  createdAt: timestamp
});

export const notificationSchema = z.object({
  id,
  userId: id,
  channel: z.enum(['email', 'sms', 'push']),
  payload: z.record(z.any()),
  read: z.boolean(),
  createdAt: timestamp
});

export const fileObjectSchema = z.object({
  id,
  tenantId: id,
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: timestamp
});

export const aiAgentSchema = z.object({
  id,
  tenantId: id,
  name: z.string(),
  description: z.string(),
  model: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp
});

export const authSessionSchema = z.object({
  id,
  userId: id,
  token: z.string(),
  expiresAt: timestamp,
  createdAt: timestamp
});
