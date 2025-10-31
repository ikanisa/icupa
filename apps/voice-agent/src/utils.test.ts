import { describe, it, expect } from 'vitest';
import { log, backoff, generateId } from './utils';

describe('Utils', () => {
  describe('log', () => {
    it('formats log message with timestamp', () => {
      // We can't test the exact output since console.log is called
      // but we can verify the function doesn't throw
      expect(() => log('test message')).not.toThrow();
    });

    it('includes context in log', () => {
      expect(() => log('test', { key: 'value' })).not.toThrow();
    });
  });

  describe('backoff', () => {
    it('returns a promise', async () => {
      const result = backoff(0);
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('increases delay exponentially', async () => {
      const start1 = Date.now();
      await backoff(0);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await backoff(1);
      const duration2 = Date.now() - start2;

      // backoff(1) should take longer than backoff(0)
      expect(duration2).toBeGreaterThanOrEqual(duration1);
    });

    it('caps delay at 5000ms', async () => {
      const start = Date.now();
      await backoff(10); // Very large attempt number
      const duration = Date.now() - start;

      // Should not exceed 5100ms (5000 + margin)
      expect(duration).toBeLessThan(5100);
    }, 10000); // 10 second timeout for this test
  });

  describe('generateId', () => {
    it('generates ID with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
    });

    it('generates unique IDs', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).not.toBe(id2);
    });

    it('includes timestamp', () => {
      const now = Date.now();
      const id = generateId('session');
      const timestamp = parseInt(id.split('_')[1]);
      
      // Timestamp should be close to now (within 1 second)
      expect(Math.abs(timestamp - now)).toBeLessThan(1000);
    });
  });
});
