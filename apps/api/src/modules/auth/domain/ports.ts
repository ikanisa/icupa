import type { z } from 'zod';
import type { AuthSession } from './entities.js';

export interface AuthSessionRepository {
  create(session: AuthSession): Promise<AuthSession>;
  findByToken(token: string): Promise<AuthSession | null>;
  findById(id: string): Promise<AuthSession | null>;
  list(): Promise<AuthSession[]>;
}

export interface Authenticator {
  verifyCredentials(identifier: string, secret: string): Promise<AuthSession>;
}
