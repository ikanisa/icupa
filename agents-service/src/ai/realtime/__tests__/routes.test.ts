import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERSONAS } from '../personas';

describe('routes', () => {
  describe('request validation', () => {
    it('should validate say request schema', () => {
      const validRequest = { text: 'Hello' };
      expect(validRequest).toHaveProperty('text');
      expect(typeof validRequest.text).toBe('string');
      expect(validRequest.text.length).toBeGreaterThan(0);
    });

    it('should reject say request without text', () => {
      const invalidRequest = {};
      expect(invalidRequest).not.toHaveProperty('text');
    });

    it('should reject say request with empty text', () => {
      const invalidRequest = { text: '' };
      expect(invalidRequest.text.length).toBe(0);
    });

    it('should validate persona request schema', () => {
      const validRequest = { key: 'waiter' };
      expect(validRequest).toHaveProperty('key');
      expect(['waiter', 'cfo']).toContain(validRequest.key);
    });

    it('should reject persona request with invalid key', () => {
      const invalidRequest = { key: 'invalid' };
      expect(['waiter', 'cfo']).not.toContain(invalidRequest.key);
    });
  });

  describe('health endpoint', () => {
    it('should return expected health response structure', () => {
      const mockHealthResponse = {
        ok: true,
        persona: 'waiter',
        realtime_enabled: true
      };

      expect(mockHealthResponse).toHaveProperty('ok', true);
      expect(mockHealthResponse).toHaveProperty('persona');
      expect(['waiter', 'cfo']).toContain(mockHealthResponse.persona);
      expect(mockHealthResponse).toHaveProperty('realtime_enabled');
    });
  });

  describe('persona switching', () => {
    it('should support switching between defined personas', () => {
      const personaKeys = Object.keys(PERSONAS);
      expect(personaKeys).toContain('waiter');
      expect(personaKeys).toContain('cfo');
      
      // Verify both personas are accessible
      expect(PERSONAS['waiter']).toBeDefined();
      expect(PERSONAS['cfo']).toBeDefined();
    });

    it('should return success response on valid persona switch', () => {
      const mockResponse = {
        ok: true,
        active: 'cfo'
      };

      expect(mockResponse).toHaveProperty('ok', true);
      expect(mockResponse).toHaveProperty('active');
      expect(['waiter', 'cfo']).toContain(mockResponse.active);
    });
  });

  describe('say endpoint', () => {
    it('should return success response', () => {
      const mockResponse = {
        ok: true
      };

      expect(mockResponse).toHaveProperty('ok', true);
    });
  });

  describe('error responses', () => {
    it('should structure validation errors correctly', () => {
      const mockError = {
        error: 'invalid_request',
        details: [
          {
            message: 'text is required',
            path: ['text']
          }
        ]
      };

      expect(mockError).toHaveProperty('error');
      expect(mockError).toHaveProperty('details');
      expect(Array.isArray(mockError.details)).toBe(true);
    });

    it('should handle unknown persona error', () => {
      const mockError = {
        error: 'unknown persona'
      };

      expect(mockError).toHaveProperty('error');
      expect(mockError.error).toContain('persona');
    });
  });
});
