import type { PrismaClient } from '@prisma/client';
import type { Authenticator } from '../../domain/ports.js';
import { authSessionEntity } from '../../domain/entities.js';

export class BasicAuthenticator implements Authenticator {
  constructor(private readonly prisma: PrismaClient) {}

  async verifyCredentials(identifier: string, secret: string) {
    const user = await this.prisma.user.findUnique({ where: { email: identifier } });
    if (!user || user.passwordHash !== secret) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    return authSessionEntity.parse({
      id: `sess_${user.id}`,
      userId: user.id,
      token: `token_${user.id}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      createdAt: new Date()
    });
  }
}
