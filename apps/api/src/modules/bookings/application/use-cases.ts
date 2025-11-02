import { bookingEntity } from '../domain/entities.js';
import type { BookingRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import type { MessagingProvider } from '../../../infrastructure/providers/types.js';

export const createBookingUseCases = (
  repository: BookingRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  messagingProvider: MessagingProvider
) => {
  const base = createUseCases(bookingEntity, repository, auditLogger, rateLimiter, 'booking');

  return {
    ...base,
    async create(input, context) {
      if (input.endDate <= input.startDate) {
        throw new Error('Invalid booking window');
      }
      const booking = await base.create(input, context);
      await messagingProvider.sendMessage(String(booking.userId), 'Booking confirmed', {
        bookingId: booking.id
      });
      return booking;
    }
  };
};
