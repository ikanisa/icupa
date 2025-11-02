import { authSessionSchema } from '@icupa/domain';
import type { z } from 'zod';

export const authSessionEntity = authSessionSchema;
export type AuthSession = z.infer<typeof authSessionEntity>;
