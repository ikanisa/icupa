/**
 * Content Security Policy (CSP) Configuration
 * 
 * Centralized CSP directives for the application.
 * This configuration removes 'unsafe-inline' by default for enhanced security.
 * 
 * Usage:
 * - In Next.js: Use in next.config.js headers() or middleware
 * - In Express/Node: Set as response header
 * - For inline scripts: Use nonces or hashes (see integration notes below)
 * 
 * Integration Notes:
 * ==================
 * 
 * ### Using Nonces (Recommended for SSR)
 * 
 * 1. Generate a nonce per request:
 *    ```typescript
 *    import { randomBytes } from 'crypto';
 *    const nonce = randomBytes(16).toString('base64');
 *    ```
 * 
 * 2. Add nonce to CSP header:
 *    ```typescript
 *    const csp = getCSPHeader({ scriptNonce: nonce, styleNonce: nonce });
 *    response.setHeader('Content-Security-Policy', csp);
 *    ```
 * 
 * 3. Add nonce to inline scripts and styles:
 *    ```html
 *    <script nonce={nonce}>console.log('safe');</script>
 *    <style nonce={nonce}>.class { color: red; }</style>
 *    ```
 * 
 * ### Using Hashes (For Static Content)
 * 
 * 1. Calculate hash of your inline script:
 *    ```bash
 *    echo -n "console.log('hello')" | openssl dgst -sha256 -binary | base64
 *    ```
 * 
 * 2. Add hash to CSP:
 *    ```typescript
 *    const scriptHashes = ["'sha256-<your-hash>'"];
 *    const csp = getCSPHeader({ scriptHashes });
 *    ```
 * 
 * ### Next.js Middleware Example:
 * 
 * ```typescript
 * import { NextResponse } from 'next/server';
 * import type { NextRequest } from 'next/server';
 * import { getCSPHeader } from '@/lib/server/csp';
 * 
 * export function middleware(request: NextRequest) {
 *   const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
 *   const response = NextResponse.next();
 *   response.headers.set('Content-Security-Policy', getCSPHeader({ scriptNonce: nonce }));
 *   response.headers.set('x-nonce', nonce);
 *   return response;
 * }
 * ```
 */

export interface CSPOptions {
  /** Nonce for inline scripts */
  scriptNonce?: string;
  /** Nonce for inline styles */
  styleNonce?: string;
  /** Array of script hashes for static inline scripts */
  scriptHashes?: string[];
  /** Array of style hashes for static inline styles */
  styleHashes?: string[];
  /** Additional script sources */
  additionalScriptSrc?: string[];
  /** Additional connect sources */
  additionalConnectSrc?: string[];
  /** Enable report-only mode (logs violations without blocking) */
  reportOnly?: boolean;
  /** Report URI for CSP violations */
  reportUri?: string;
}

/**
 * Get Content Security Policy directives as an object
 */
export function getCSPDirectives(options: CSPOptions = {}): Record<string, string[]> {
  const {
    scriptNonce,
    styleNonce,
    scriptHashes = [],
    styleHashes = [],
    additionalScriptSrc = [],
    additionalConnectSrc = [],
  } = options;

  // Build script-src directive
  const scriptSrc = ["'self'"];
  if (scriptNonce) {
    scriptSrc.push(`'nonce-${scriptNonce}'`);
  }
  scriptSrc.push(...scriptHashes);
  scriptSrc.push(...additionalScriptSrc);

  // Build style-src directive
  const styleSrc = ["'self'"];
  if (styleNonce) {
    styleSrc.push(`'nonce-${styleNonce}'`);
  }
  styleSrc.push(...styleHashes);

  // Build connect-src directive
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "https://*.supabase.in",
    ...additionalConnectSrc,
  ];

  return {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "frame-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "upgrade-insecure-requests": [],
  };
}

/**
 * Convert CSP directives object to header string
 */
export function directivesToString(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(" ")}`;
    })
    .join("; ");
}

/**
 * Get Content Security Policy header string
 * 
 * @param options - CSP configuration options
 * @returns CSP header string
 * 
 * @example
 * ```typescript
 * // With nonce
 * const csp = getCSPHeader({ scriptNonce: 'abc123' });
 * response.setHeader('Content-Security-Policy', csp);
 * 
 * // With hashes
 * const csp = getCSPHeader({ 
 *   scriptHashes: ["'sha256-xyz...'"]
 * });
 * 
 * // Report-only mode
 * const csp = getCSPHeader({ reportOnly: true, reportUri: '/api/csp-report' });
 * response.setHeader('Content-Security-Policy-Report-Only', csp);
 * ```
 */
export function getCSPHeader(options: CSPOptions = {}): string {
  const directives = getCSPDirectives(options);
  let header = directivesToString(directives);

  if (options.reportUri) {
    header += `; report-uri ${options.reportUri}`;
  }

  return header;
}

/**
 * Get CSP header name based on report-only mode
 */
export function getCSPHeaderName(reportOnly: boolean = false): string {
  return reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

/**
 * Apply CSP header to a response object (works with Express, Next.js, etc.)
 * 
 * @example
 * ```typescript
 * // Express
 * applyCSP(res, { scriptNonce: nonce });
 * 
 * // Next.js API route
 * applyCSP(res, { scriptNonce: nonce });
 * ```
 */
export function applyCSP(
  response: { setHeader: (name: string, value: string) => void },
  options: CSPOptions = {}
): void {
  const headerName = getCSPHeaderName(options.reportOnly);
  const headerValue = getCSPHeader(options);
  response.setHeader(headerName, headerValue);
}

/**
 * Additional security headers to complement CSP
 */
export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};

/**
 * Apply all security headers including CSP
 */
export function applySecurityHeaders(
  response: { setHeader: (name: string, value: string) => void },
  cspOptions: CSPOptions = {}
): void {
  // Apply CSP
  applyCSP(response, cspOptions);

  // Apply other security headers
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => {
    response.setHeader(name, value);
  });
}
