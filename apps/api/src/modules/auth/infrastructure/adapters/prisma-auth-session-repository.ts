import type { PrismaClient } from '@prisma/client';
import type { AuthSession } from '../../domain/entities.js';
import type { AuthSessionRepository } from '../../domain/ports.js';

export class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(session: AuthSession) {
    return this.prisma.authSession.create({ data: session });
  }

  findByToken(token: string) {
    return this.prisma.authSession.findUnique({ where: { token } });
  }

  findById(id: string) {
    return this.prisma.authSession.findUnique({ where: { id } });
  }

  list() {
    return this.prisma.authSession.findMany();
  }
}
