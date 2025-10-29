# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

The ICUPA team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings.

### Where to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities via email to:

**security@icupa.app** (or contact repository maintainers directly)

Include the following information:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting)
- Full paths of source file(s) related to the manifestation of the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- **Initial Response:** Within 48 hours, we will acknowledge receipt of your vulnerability report
- **Triage:** Within 5 business days, we will provide an initial assessment and expected timeline
- **Fix Development:** We will work on a fix and coordinate a disclosure timeline with you
- **Public Disclosure:** Once a fix is available, we will release a security advisory and credit you (unless you prefer to remain anonymous)

### Disclosure Policy

- Let us know as soon as possible upon discovery of a potential security issue
- Provide us a reasonable amount of time to fix the issue before public disclosure (typically 90 days)
- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services

### Safe Harbor

We support safe harbor for security researchers who:
- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- Only interact with accounts they own or with explicit permission of the account holder
- Do not exploit a security vulnerability beyond the minimum necessary to demonstrate it

We will not pursue legal action against researchers who follow these guidelines.

## Security Best Practices for Contributors

### Code Review
- All code changes require review by at least one maintainer
- Security-sensitive changes require review by security team
- Automated security scans (CodeQL, dependency audit) must pass

### Dependencies
- Keep dependencies up to date
- Review Dependabot alerts weekly
- Use `pnpm audit` before releases
- Avoid dependencies with known high-severity CVEs

### Secrets Management
- Never commit secrets, API keys, or credentials to Git
- Use environment variables for all secrets
- Use Supabase Vault or similar for production secrets
- Rotate secrets annually or after suspected compromise

### Authentication & Authorization
- Use Supabase RLS policies for all data access
- Validate JWT tokens on all Edge Functions
- Use row-level security for multi-tenant isolation
- Implement rate limiting on authentication endpoints

### Input Validation
- Validate all user input on both client and server
- Use Zod schemas for type-safe validation
- Sanitize user input before display (XSS prevention)
- Use parameterized queries (Supabase handles this)

### HTTPS/TLS
- Enforce HTTPS in production
- Use secure cookies (httpOnly, secure, sameSite)
- Implement HSTS headers
- Pin certificate expectations where appropriate

## Security Features

### Built-in Security
- ✅ **Row-Level Security (RLS):** PostgreSQL RLS policies enforce tenant isolation
- ✅ **JWT Authentication:** Supabase handles secure session management
- ✅ **Webhook Signatures:** Stripe, MoMo, Airtel webhooks verified
- ✅ **Secret Scanning:** CI checks for leaked credentials
- ✅ **Dependency Audits:** Automated checks in CI pipeline

### Planned Security Enhancements
- 🔄 **CodeQL SAST:** Static analysis in CI (in progress)
- 🔄 **Dependabot:** Automated dependency updates (in progress)
- 🔄 **Container Scanning:** Trivy/Snyk for Docker images (planned)
- 🔄 **CSP Headers:** Content-Security-Policy for XSS mitigation (planned)
- 🔄 **Rate Limiting:** Per-endpoint and per-tenant limits (planned)

## Security Contacts

- **Security Team:** security@icupa.app
- **Engineering Lead:** [To be added]
- **CTO/CISO:** [To be added]

## Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

- [No disclosures yet]

## Further Information

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)

---

**Last Updated:** 2025-10-29  
**Version:** 1.0
