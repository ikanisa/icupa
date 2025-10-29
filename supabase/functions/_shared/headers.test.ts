import { describe, expect, it } from 'vitest';
import { readHeader, requireHeader } from './headers';

describe('headers utilities', () => {
  it('reads headers ignoring case', () => {
    const request = new Request('https://example.com', {
      headers: {
        'X-ICUPA-Session': 'abc',
        'x-custom': 'value',
      },
    });

    expect(readHeader(request, 'x-icupa-session')).toBe('abc');
    expect(readHeader(request, 'X-CUSTOM')).toBe('value');
  });

  it('returns null when missing', () => {
    const request = new Request('https://example.com');
    expect(readHeader(request, 'x-icupa-session')).toBeNull();
  });

  it('requires header and returns value', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-token': '  secret ' },
    });

    // Note: Request headers API automatically trims whitespace
    expect(requireHeader(request, 'x-token')).toBe('secret');
  });

  it('throws when required header missing', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-token': '   ' },
    });

    expect(() => requireHeader(request, 'x-token')).toThrow('Header x-token is required');
  });
});
