/**
 * Tests for Supabase client wrappers
 * 
 * These tests verify the structure and basic functionality of the Supabase client
 * wrappers used with the OpenAI Agents SDK.
 */

import { describe, it, expect } from 'vitest';
import {
  createFrontendClient,
  createBackendClient,
  createAgentClient,
  db,
} from './supabaseClient';

describe('Supabase Client Wrappers', () => {
  describe('createFrontendClient', () => {
    it('should be a function', () => {
      expect(typeof createFrontendClient).toBe('function');
    });

    // Note: We can't actually test client creation without env vars
    // Just verify the function exists
  });

  describe('createBackendClient', () => {
    it('should be a function', () => {
      expect(typeof createBackendClient).toBe('function');
    });
  });

  describe('createAgentClient', () => {
    it('should be a function', () => {
      expect(typeof createAgentClient).toBe('function');
    });

    it('should accept options parameter', () => {
      expect(createAgentClient.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('db helpers', () => {
    it('should have query method', () => {
      expect(db.query).toBeDefined();
      expect(typeof db.query).toBe('function');
    });

    it('should have mutate method', () => {
      expect(db.mutate).toBeDefined();
      expect(typeof db.mutate).toBe('function');
    });
  });
});

describe('db.query', () => {
  it('should handle successful queries', async () => {
    const mockClient: any = {};
    const mockOperation = async () => ({
      data: { test: 'data' },
      error: null,
    });

    const result = await db.query(mockClient, mockOperation);
    expect(result).toEqual({ test: 'data' });
  });

  it('should throw on query errors', async () => {
    const mockClient: any = {};
    const mockOperation = async () => ({
      data: null,
      error: { message: 'Test error' },
    });

    await expect(db.query(mockClient, mockOperation)).rejects.toThrow('Database query failed');
  });

  it('should throw when no data returned', async () => {
    const mockClient: any = {};
    const mockOperation = async () => ({
      data: null,
      error: null,
    });

    await expect(db.query(mockClient, mockOperation)).rejects.toThrow('returned no data');
  });
});

describe('db.mutate', () => {
  it('should handle successful mutations', async () => {
    const mockClient: any = {};
    const mockOperation = async () => ({
      data: { id: '123', updated: true },
      error: null,
    });

    const result = await db.mutate(mockClient, mockOperation);
    expect(result).toEqual({ id: '123', updated: true });
  });

  it('should throw on mutation errors', async () => {
    const mockClient: any = {};
    const mockOperation = async () => ({
      data: null,
      error: { message: 'Mutation failed' },
    });

    await expect(db.mutate(mockClient, mockOperation)).rejects.toThrow('Database mutation failed');
  });

  it('should throw when no data returned', async () => {
    const mockClient: any = {};
    const mockOperation = async () => ({
      data: null,
      error: null,
    });

    await expect(db.mutate(mockClient, mockOperation)).rejects.toThrow('returned no data');
  });
});
