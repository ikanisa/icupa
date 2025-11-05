import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { RateLimiter } from '../../modules/shared/ports.js';

const limiter = new RateLimiterMemory({
  points: 100,
  duration: 60
});

export const rateLimiter: RateLimiter = {
  async consume(key) {
    await limiter.consume(key);
  }
};
